import { useEffect, useState, useCallback } from "react";
import { VaultLib, OpenNewBatchEvent, CloseBatchEvent } from "@mirrorworld/sonic.vault";
import { VAULT_CONFIG, createVaultConnection } from "@/config/vault";
import { Keypair } from "@solana/web3.js";

/**
 * Batch 状态类型
 */
export type BatchStatus = 'draft' | 'batchOpen' | 'batchClose';

/**
 * Batch 信息接口
 */
export interface BatchInfo {
  currentBatchIndex: number;
  vaultBatchStatus: BatchStatus;
  canDeposit: boolean;
  batchDetail?: {
    batchIndex: number;
    status: 'open' | 'close';
    openAt: Date;
    willCloseAt: Date;
    remainingMinutes: number;
    sharePrice: string;
    totalDepositAmount: string;
  };
  message: string;
}

/**
 * 简单的 Wallet 实现
 */
class DummyWallet {
  constructor(public payer: Keypair) {}
  async signTransaction<T>(tx: T): Promise<T> { return tx; }
  async signAllTransactions<T>(txs: T[]): Promise<T[]> { return txs; }
  get publicKey() { return this.payer.publicKey; }
}

/**
 * 监听 Vault Batch 状态的 Hook
 * 
 * 功能:
 * 1. 实时监听 OpenNewBatch 和 CloseBatch 事件
 * 2. 定期查询 Batch 状态
 * 3. 判断当前是否可以 deposit
 */
export const useBatchMonitor = (autoRefresh = true) => {
  const [batchInfo, setBatchInfo] = useState<BatchInfo>({
    currentBatchIndex: 0,
    vaultBatchStatus: 'draft',
    canDeposit: false,
    message: "正在加载...",
  });
  const [loading, setLoading] = useState(true);
  const [vaultLib, setVaultLib] = useState<VaultLib | null>(null);

  // 初始化 VaultLib
  useEffect(() => {
    const connection = createVaultConnection();
    const dummyWallet = new DummyWallet(Keypair.generate());
    const lib = new VaultLib(VAULT_CONFIG.PROGRAM_ID, connection, dummyWallet as any);
    setVaultLib(lib);
  }, []);

  // 获取 Batch 详细信息
  const fetchBatchInfo = useCallback(async (): Promise<BatchInfo> => {
    if (!vaultLib) {
      return {
        currentBatchIndex: 0,
        vaultBatchStatus: 'draft',
        canDeposit: false,
        message: "VaultLib 未初始化",
      };
    }

    try {
      // 1. 获取 Vault Detail
      const vaultDetail = await vaultLib.getVaultDetailAccountData(VAULT_CONFIG.VAULT_NAME);
      const currentBatchIndex = vaultDetail.batchCount;

      // 2. 确定 vault batch status
      let vaultBatchStatus: BatchStatus = 'draft';
      if ('batchOpen' in vaultDetail.vaultBatchStatus) {
        vaultBatchStatus = 'batchOpen';
      } else if ('batchClose' in vaultDetail.vaultBatchStatus) {
        vaultBatchStatus = 'batchClose';
      }

      // 3. 检查是否有 batch
      if (currentBatchIndex === 0) {
        return {
          currentBatchIndex: 0,
          vaultBatchStatus,
          canDeposit: false,
          message: "Vault 还没有创建任何 batch",
        };
      }

      // 4. 如果 vault 状态不是 BatchOpen，则不能 deposit
      if (vaultBatchStatus !== 'batchOpen') {
        return {
          currentBatchIndex,
          vaultBatchStatus,
          canDeposit: false,
          message: vaultBatchStatus === 'draft' 
            ? "当前没有开放的 batch" 
            : "Batch 正在关闭中",
        };
      }

      // 5. 尝试获取 Batch Detail
      try {
        const batchDetail = await vaultLib.getVaultBatchDetailAccountData(
          VAULT_CONFIG.VAULT_NAME,
          currentBatchIndex
        );

        const now = Math.floor(Date.now() / 1000);
        const remainingSeconds = batchDetail.willCloseAt - now;
        const remainingMinutes = Math.floor(remainingSeconds / 60);

        // 检查 batch 状态
        const batchStatus = 'close' in batchDetail.status ? 'close' : 'open';
        
        if (batchStatus === 'close') {
          return {
            currentBatchIndex,
            vaultBatchStatus,
            canDeposit: false,
            message: `Batch #${currentBatchIndex} 已关闭`,
          };
        }

        // 检查时间
        if (now > batchDetail.willCloseAt) {
          return {
            currentBatchIndex,
            vaultBatchStatus,
            canDeposit: false,
            batchDetail: {
              batchIndex: batchDetail.batchIndex,
              status: batchStatus,
              openAt: new Date(batchDetail.openAt * 1000),
              willCloseAt: new Date(batchDetail.willCloseAt * 1000),
              remainingMinutes: 0,
              sharePrice: batchDetail.sharePrice.toString(),
              totalDepositAmount: batchDetail.totalDepositAmount.toString(),
            },
            message: `Batch #${currentBatchIndex} 已超时`,
          };
        }

        // ✅ 可以 deposit
        return {
          currentBatchIndex,
          vaultBatchStatus,
          canDeposit: true,
          batchDetail: {
            batchIndex: batchDetail.batchIndex,
            status: batchStatus,
            openAt: new Date(batchDetail.openAt * 1000),
            willCloseAt: new Date(batchDetail.willCloseAt * 1000),
            remainingMinutes,
            sharePrice: batchDetail.sharePrice.toString(),
            totalDepositAmount: batchDetail.totalDepositAmount.toString(),
          },
          message: `Batch #${currentBatchIndex} 可用，还有 ${remainingMinutes} 分钟关闭`,
        };

      } catch (err) {
        // Batch 账户不存在
        return {
          currentBatchIndex,
          vaultBatchStatus,
          canDeposit: false,
          message: `Batch #${currentBatchIndex} 未初始化（管理员还没有调用 open_new_batch）`,
        };
      }

    } catch (err: any) {
      console.error("获取 Batch 信息失败:", err);
      return {
        currentBatchIndex: 0,
        vaultBatchStatus: 'draft',
        canDeposit: false,
        message: `获取失败: ${err.message}`,
      };
    }
  }, [vaultLib]);

  // 刷新 Batch 信息
  const refreshBatchInfo = useCallback(async () => {
    setLoading(true);
    const info = await fetchBatchInfo();
    setBatchInfo(info);
    setLoading(false);
  }, [fetchBatchInfo]);

  // 初始加载和定期刷新
  useEffect(() => {
    if (!vaultLib) return;

    refreshBatchInfo();

    if (!autoRefresh) return;

    // 每 10 秒刷新一次
    const interval = setInterval(refreshBatchInfo, 10000);
    return () => clearInterval(interval);
  }, [vaultLib, autoRefresh, refreshBatchInfo]);

  // 监听 OpenNewBatch 事件
  useEffect(() => {
    if (!vaultLib) return;

    const handleOpenNewBatch = (event: OpenNewBatchEvent) => {
      console.log("🎉 新 Batch 开启事件:", {
        batchIndex: event.batchIndex,
        sharePrice: event.sharePrice.toString(),
        timestamp: new Date(event.timestamp * 1000).toLocaleString(),
      });

      // 立即刷新状态
      refreshBatchInfo();
    };

    const listenerId = vaultLib.addOpenNewBatchEventListener(handleOpenNewBatch);

    return () => {
      vaultLib.removeEventListener(listenerId);
    };
  }, [vaultLib, refreshBatchInfo]);

  // 监听 CloseBatch 事件
  useEffect(() => {
    if (!vaultLib) return;

    const handleCloseBatch = (event: CloseBatchEvent) => {
      console.log("🔒 Batch 关闭事件:", {
        batchIndex: event.batchIndex,
        timestamp: new Date(event.timestamp * 1000).toLocaleString(),
      });

      // 立即刷新状态
      refreshBatchInfo();
    };

    const listenerId = vaultLib.addCloseBatchEventListener(handleCloseBatch);

    return () => {
      vaultLib.removeEventListener(listenerId);
    };
  }, [vaultLib, refreshBatchInfo]);

  return {
    batchInfo,
    loading,
    refreshBatchInfo,
    vaultLib,
  };
};

