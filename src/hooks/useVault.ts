import { useEffect, useState, useCallback } from "react";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction, VersionedTransaction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { 
  ASSOCIATED_TOKEN_PROGRAM_ID, 
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
  createAssociatedTokenAccountInstruction
} from "@solana/spl-token";
import { VaultLib } from "@mirrorworld/sonic.vault";
import { VAULT_CONFIG, createVaultConnection } from "@/config/vault";
import { appKit } from "@/config/wallet";

// 简单的 Wallet 实现，用于初始化 VaultLib
class DummyWallet {
  constructor(public payer: Keypair) {}

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    return tx;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    return txs;
  }

  get publicKey(): PublicKey {
    return this.payer.publicKey;
  }
}

interface VaultData {
  tvl: string;
  apy: string;
  sharePrice: string;
  currentBatchIndex: number;
}

interface UserPosition {
  balance: string;
  earnings: string;
  shares: string;
  depositCount: number;
  withdrawCount: number;
  availableShares: string; // 可用于提现的 shares（扣除正在处理的）
}

export interface PendingWithdraw {
  withdrawIndex: number;
  shares: string;
  canWithdrawAt: Date;
  status: 'requested' | 'processed' | 'canceled';
  isReady: boolean; // 是否已过冷却期
}

export interface PendingDeposit {
  depositIndex: number;
  batchIndex: number;
  amount: string;
  fee: string;
  status: 'deposited' | 'processed';
  isProcessed: boolean;
}

export const useVault = () => {
  const [vaultLib, setVaultLib] = useState<VaultLib | null>(null);
  const [userAddress, setUserAddress] = useState<PublicKey | null>(null);
  const [vaultData, setVaultData] = useState<VaultData>({
    tvl: "0",
    apy: "0",
    sharePrice: "0",
    currentBatchIndex: 0,
  });
  const [userPosition, setUserPosition] = useState<UserPosition>({
    balance: "0",
    earnings: "0",
    shares: "0",
    depositCount: 0,
    withdrawCount: 0,
    availableShares: "0",
  });
  const [pendingWithdraws, setPendingWithdraws] = useState<PendingWithdraw[]>([]);
  const [pendingDeposits, setPendingDeposits] = useState<PendingDeposit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初始化 VaultLib
  useEffect(() => {
    const connection = createVaultConnection();
    const dummyWallet = new DummyWallet(Keypair.generate());
    const vault = new VaultLib(VAULT_CONFIG.PROGRAM_ID, connection, dummyWallet as any);
    setVaultLib(vault);

    // 监听钱包连接
    const unsubscribe = appKit.subscribeAccount((account) => {
      if (account?.address) {
        try {
          setUserAddress(new PublicKey(account.address));
        } catch (err) {
          console.error("Invalid wallet address:", err);
          setUserAddress(null);
        }
      } else {
        setUserAddress(null);
      }
    });

    return unsubscribe;
  }, []);

  // 获取 Vault 数据
  const fetchVaultData = useCallback(async () => {
    if (!vaultLib) return;

    try {
      const vaultDetail = await vaultLib.getVaultDetailAccountData(VAULT_CONFIG.VAULT_NAME);
      const currentBatchIndex = await vaultLib.getCurrentVaultBatchIndex(VAULT_CONFIG.VAULT_NAME);

      // 计算 TVL（总锁定价值）
      const tvl = vaultDetail.totalDepositAmount.div(new BN(10 ** VAULT_CONFIG.DEFAULT_MINT_DECIMAL)).toString();

      // 计算 Share Price
      const sharePrice = vaultDetail.currentSharePrice.div(new BN(10 ** VAULT_CONFIG.DEFAULT_MINT_DECIMAL)).toString();

      setVaultData({
        tvl,
        apy: "0", // APY 需要根据实际业务逻辑计算
        sharePrice,
        currentBatchIndex,
      });
    } catch (err) {
      console.error("Failed to fetch vault data:", err);
      setError("Failed to fetch vault data");
    }
  }, [vaultLib]);

  // 获取用户的 Token 余额
  const fetchTokenBalance = useCallback(async (userAddress: PublicKey): Promise<string> => {
    try {
      const connection = createVaultConnection();
      
      // 获取用户的关联 token 账户地址
      const userTokenAccount = getAssociatedTokenAddressSync(
        VAULT_CONFIG.TOKEN_MINT,
        userAddress,
        false, // allowOwnerOffCurve
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // 获取账户信息
      const accountInfo = await getAccount(
        connection,
        userTokenAccount,
        VAULT_CONFIG.COMMITMENT,
        TOKEN_2022_PROGRAM_ID
      );

      // 转换为可读格式（考虑 decimal）
      const balance = Number(accountInfo.amount) / (10 ** VAULT_CONFIG.DEFAULT_MINT_DECIMAL);
      return balance.toString();
    } catch (error) {
      console.error("Failed to fetch token balance:", error);
      // 如果账户不存在或其他错误，返回 0
      return "0";
    }
  }, []);

  // 获取用户数据
  const fetchUserPosition = useCallback(async () => {
    if (!vaultLib || !userAddress) return;

    try {
      const userDetail = await vaultLib.getUserDetailAccountData(
        VAULT_CONFIG.VAULT_NAME,
        userAddress
      );

      console.log('userDetail', userDetail);

      // 获取用户的真实 token 余额
      const balance = await fetchTokenBalance(userAddress);

      // 计算 shares
      const shares = userDetail.currentShares.div(new BN(10 ** VAULT_CONFIG.DEFAULT_MINT_DECIMAL)).toString();

      // 计算可用 shares（扣除正在处理中的）
      const availableShares = userDetail.currentShares
        .sub(userDetail.inProcessShareWithdraw)
        .div(new BN(10 ** VAULT_CONFIG.DEFAULT_MINT_DECIMAL))
        .toString();

      // 计算 earnings
      const depositAmount = userDetail.totalDepositAmount.div(new BN(10 ** VAULT_CONFIG.DEFAULT_MINT_DECIMAL));
      const currentValue = userDetail.currentShares.mul(
        new BN(parseFloat(vaultData.sharePrice || "0") * 10 ** VAULT_CONFIG.DEFAULT_MINT_DECIMAL)
      ).div(new BN(10 ** VAULT_CONFIG.DEFAULT_MINT_DECIMAL));
      const earnings = currentValue.sub(depositAmount).toString();

      setUserPosition({
        balance,
        earnings,
        shares,
        depositCount: userDetail.depositCount,
        withdrawCount: userDetail.requestedShareWithdrawCount,
        availableShares,
      });
    } catch (err: any) {
      // 用户在这个 vault 中还没有任何操作，UserDetailAccount 不存在
      // 这是正常情况，不需要显示错误
      if (!err.message?.includes("Account does not exist")) {
        console.error("Failed to fetch user position:", err);
      }
      
      // 获取 token balance
      const balance = userAddress ? await fetchTokenBalance(userAddress) : "0";
      setUserPosition({
        balance,
        earnings: "0",
        shares: "0",
        depositCount: 0,
        withdrawCount: 0,
        availableShares: "0",
      });
    }
  }, [vaultLib, userAddress, vaultData.sharePrice, fetchTokenBalance]);

  // 获取待处理的存款列表
  const fetchPendingDeposits = useCallback(async () => {
    if (!vaultLib || !userAddress) return;

    try {
      const userDetail = await vaultLib.getUserDetailAccountData(
        VAULT_CONFIG.VAULT_NAME,
        userAddress
      );

      const deposits: PendingDeposit[] = [];

      // 获取每个存款的详情
      for (let i = 1; i <= userDetail.depositCount; i++) {
        try {
          const depositDetail = await vaultLib.getUserDepositDetailAccountData(
            VAULT_CONFIG.VAULT_NAME,
            userAddress,
            i
          );

          // 确定状态
          const isProcessed = 'processed' in depositDetail.status;
          const status: 'deposited' | 'processed' = isProcessed ? 'processed' : 'deposited';

          // 只显示未处理的存款
          if (!isProcessed) {
            deposits.push({
              depositIndex: depositDetail.depositIndex,
              batchIndex: depositDetail.batchIndex,
              amount: depositDetail.depositAmount
                .div(new BN(10 ** VAULT_CONFIG.DEFAULT_MINT_DECIMAL))
                .toString(),
              fee: depositDetail.depositFee
                .div(new BN(10 ** VAULT_CONFIG.DEFAULT_MINT_DECIMAL))
                .toString(),
              status,
              isProcessed,
            });
          }
        } catch (err) {
          console.error(`Failed to fetch deposit #${i}:`, err);
        }
      }

      setPendingDeposits(deposits);
    } catch (err: any) {
      // UserDetailAccount 不存在是正常的（用户还没有存款）
      if (!err.message?.includes("Account does not exist")) {
        console.error("Failed to fetch pending deposits:", err);
      }
      setPendingDeposits([]);
    }
  }, [vaultLib, userAddress]);

  // 获取待处理的提现列表
  const fetchPendingWithdraws = useCallback(async () => {
    if (!vaultLib || !userAddress) return;

    try {
      const userDetail = await vaultLib.getUserDetailAccountData(
        VAULT_CONFIG.VAULT_NAME,
        userAddress
      );

      const withdraws: PendingWithdraw[] = [];
      const now = Math.floor(Date.now() / 1000);

      // 获取每个提现请求的详情
      for (let i = 1; i <= userDetail.requestedShareWithdrawCount; i++) {
        try {
          const withdrawDetail = await vaultLib.getUserWithdrawDetailAccountData(
            VAULT_CONFIG.VAULT_NAME,
            userAddress,
            i
          );

          // 确定状态
          let status: 'requested' | 'processed' | 'canceled' = 'requested';
          if ('processed' in withdrawDetail.status) {
            status = 'processed';
          } else if ('canceled' in withdrawDetail.status) {
            status = 'canceled';
          }

          // 只显示 requested 状态的提现
          if (status === 'requested') {
            const isReady = now >= Number(withdrawDetail.canWithdrawAt);
            
            withdraws.push({
              withdrawIndex: withdrawDetail.withdrawIndex,
              shares: withdrawDetail.requestedWithdrawShares
                .div(new BN(10 ** VAULT_CONFIG.DEFAULT_MINT_DECIMAL))
                .toString(),
              canWithdrawAt: new Date(Number(withdrawDetail.canWithdrawAt) * 1000),
              status,
              isReady,
            });
          }
        } catch (err) {
          console.error(`Failed to fetch withdraw #${i}:`, err);
        }
      }

      setPendingWithdraws(withdraws);
    } catch (err: any) {
      // UserDetailAccount 不存在是正常的（用户还没有存款）
      if (!err.message?.includes("Account does not exist")) {
        console.error("Failed to fetch pending withdraws:", err);
      }
      setPendingWithdraws([]);
    }
  }, [vaultLib, userAddress]);

  // 自动获取数据
  useEffect(() => {
    fetchVaultData();
    const interval = setInterval(fetchVaultData, 30000); // 每30秒刷新一次
    return () => clearInterval(interval);
  }, [fetchVaultData]);

  useEffect(() => {
    if (userAddress) {
      fetchUserPosition();
      fetchPendingDeposits();
      fetchPendingWithdraws();
      const interval = setInterval(() => {
        fetchUserPosition();
        fetchPendingDeposits();
        fetchPendingWithdraws();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [userAddress, fetchUserPosition, fetchPendingDeposits, fetchPendingWithdraws]);

  // Deposit 方法
  const deposit = useCallback(
    async (amount: string) => {
      if (!vaultLib || !userAddress) {
        throw new Error("Vault not initialized or user not connected");
      }

      setLoading(true);
      setError(null);

      try {
        // 获取连接
        const connection = createVaultConnection();
        
        // 获取 vault detail (包含配置信息)
        const vaultDetail = await vaultLib.getVaultDetailAccountData(VAULT_CONFIG.VAULT_NAME);
        
        // 获取当前 batch index
        const currentBatchIndex = vaultDetail.batchCount;
        
        console.log('Vault Config:', {
          batchCount: currentBatchIndex,
          vaultStatus: vaultDetail.vaultStatus,
          depositTxFee: vaultDetail.depositTxFee.toString(),
        });
        
        // 检查是否有 batch
        if (currentBatchIndex === 0) {
          throw new Error("No batches available. Please contact vault administrator.");
        }
        
        // 尝试获取当前 batch 的详细信息
        let currentBatch;
        try {
          currentBatch = await vaultLib.getVaultBatchDetailAccountData(
            VAULT_CONFIG.VAULT_NAME,
            currentBatchIndex
          );
          
          console.log('Batch Details:', {
            batchIndex: currentBatch.batchIndex,
            status: currentBatch.status,
            openAt: new Date(currentBatch.openAt * 1000).toLocaleString(),
            willCloseAt: new Date(currentBatch.willCloseAt * 1000).toLocaleString(),
            totalDepositAmount: currentBatch.totalDepositAmount.toString(),
          });
        } catch (err: any) {
          console.error("Failed to fetch batch details:", err);
          throw new Error(
            `Batch #${currentBatchIndex} does not exist or is not initialized.\n` +
            `The administrator needs to call open_new_batch.\n` +
            `Please contact the vault administrator.`
          );
        }
        
        // 检查 batch 状态
        if ('close' in currentBatch.status) {
          throw new Error(
            `Batch #${currentBatchIndex} is closed.\n` +
            `Please wait for administrator to open a new batch.`
          );
        }
        
        // 检查时间
        const now = Math.floor(Date.now() / 1000);
        if (now > currentBatch.willCloseAt) {
          const closeTime = new Date(currentBatch.willCloseAt * 1000).toLocaleString();
          throw new Error(
            `Batch #${currentBatchIndex} has expired (deadline: ${closeTime}).\n` +
            `Please wait for administrator to close current batch and open a new one.`
          );
        }
        
        // 计算剩余时间
        const remainingSeconds = currentBatch.willCloseAt - now;
        const remainingMinutes = Math.floor(remainingSeconds / 60);
        console.log(`✅ Batch #${currentBatchIndex} available, ${remainingMinutes} minutes remaining`);
        
        // 获取用户的下一个 deposit index
        const newDepositIndex = (await vaultLib.getCurrentUserDepositIndex(
          VAULT_CONFIG.VAULT_NAME,
          userAddress
        )) + 1;

        // 转换金额为 lamports
        const depositAmount = new BN(
          parseFloat(amount) * 10 ** VAULT_CONFIG.DEFAULT_MINT_DECIMAL
        );

        // 获取用户的 token account 地址
        const userTokenAccount = getAssociatedTokenAddressSync(
          VAULT_CONFIG.TOKEN_MINT,
          userAddress,
          false, // allowOwnerOffCurve
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );

        // 创建主交易
        const tx = new Transaction();

        // 检查用户的 token account 是否存在，如果不存在则添加创建指令
        try {
          await getAccount(
            connection,
            userTokenAccount,
            VAULT_CONFIG.COMMITMENT,
            TOKEN_2022_PROGRAM_ID
          );
          console.log("User token account exists:", userTokenAccount.toBase58());
        } catch (error) {
          // 账户不存在，添加创建指令
          console.log("Creating user token account:", userTokenAccount.toBase58());
          const createATAIx = createAssociatedTokenAccountInstruction(
            userAddress, // payer
            userTokenAccount, // ata
            userAddress, // owner
            VAULT_CONFIG.TOKEN_MINT, // mint
            TOKEN_2022_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          );
          tx.add(createATAIx);
        }

        // 创建 deposit 交易
        const depositTx = await vaultLib.createDepositTransaction(
          userAddress, // feeAndRentPayer
          userAddress, // depositProvider
          userAddress, // user
          VAULT_CONFIG.VAULT_NAME,
          currentBatchIndex,
          newDepositIndex,
          depositAmount,
          vaultDetail.depositTxFeeReceiver, // 从 vault 配置中获取
          VAULT_CONFIG.TOKEN_MINT,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
          SystemProgram.programId,
          SYSVAR_RENT_PUBKEY
        );

        // 将 deposit 指令添加到主交易中
        tx.add(...depositTx.instructions);

        // 添加 fee payer 和 recent blockhash
        await vaultLib.addFeePayerAndRecentBlockHashInTransaction(tx, userAddress);
        
        // 使用 AppKit 的 Solana provider 进行签名和发送
        const provider = appKit.getWalletProvider() as any;

        console.log("provider", provider);
        
        if (!provider || !provider.signTransaction) {
          throw new Error("Wallet does not support transaction signing");
        }

        // 通过钱包签名交易
        const signedTx = await provider.signTransaction(tx);
        
        // 发送已签名的交易
        const signature = await connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: false,
          preflightCommitment: VAULT_CONFIG.COMMITMENT,
        });
        
        console.log("Deposit transaction signature:", signature);

        // 等待确认
        await connection.confirmTransaction(signature, VAULT_CONFIG.COMMITMENT);

        // 刷新数据
        await fetchUserPosition();
        await fetchVaultData();

        return signature;
      } catch (err: any) {
        console.error("Deposit failed:", err);
        setError(err.message || "Deposit failed");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [vaultLib, userAddress, fetchUserPosition, fetchVaultData]
  );

  // Request Withdraw 方法
  const requestWithdraw = useCallback(
    async (shares: string) => {
      if (!vaultLib || !userAddress) {
        throw new Error("Vault not initialized or user not connected");
      }

      setLoading(true);
      setError(null);

      try {
        // 获取连接
        const connection = createVaultConnection();
        
        // 获取用户详情，验证 shares
        let userDetail;
        try {
          userDetail = await vaultLib.getUserDetailAccountData(
            VAULT_CONFIG.VAULT_NAME,
            userAddress
          );
        } catch (err: any) {
          if (err.message?.includes("Account does not exist")) {
            throw new Error("You have no deposits in this vault yet. Please deposit first.");
          }
          throw err;
        }

        // 计算可用 shares
        const availableSharesBN = userDetail.currentShares.sub(userDetail.inProcessShareWithdraw);
        
        console.log('User Shares Info:', {
          currentShares: userDetail.currentShares.toString(),
          inProcessShareWithdraw: userDetail.inProcessShareWithdraw.toString(),
          availableShares: availableSharesBN.toString(),
        });

        // 转换请求的 shares 为 BN
        const withdrawShares = new BN(
          parseFloat(shares) * 10 ** VAULT_CONFIG.DEFAULT_MINT_DECIMAL
        );

        // 验证：请求的 shares 不能超过可用 shares
        if (withdrawShares.gt(availableSharesBN)) {
          throw new Error(
            `Insufficient available shares.\n` +
            `Requested: ${shares}\n` +
            `Available: ${availableSharesBN.div(new BN(10 ** VAULT_CONFIG.DEFAULT_MINT_DECIMAL)).toString()}`
          );
        }

        // 验证：shares 必须大于 0
        if (withdrawShares.lte(new BN(0))) {
          throw new Error("Withdrawal amount must be greater than 0");
        }

        // 获取当前 batch index
        const currentBatchIndex = await vaultLib.getCurrentVaultBatchIndex(VAULT_CONFIG.VAULT_NAME);

        // 获取用户的下一个 withdraw index
        const newWithdrawIndex = (await vaultLib.getCurrentUserWithdrawIndex(
          VAULT_CONFIG.VAULT_NAME,
          userAddress
        )) + 1;

        console.log('Request Withdraw Info:', {
          currentBatchIndex,
          newWithdrawIndex,
          requestedShares: shares,
          requestedSharesRaw: withdrawShares.toString(),
        });

        // 创建交易
        const tx = await vaultLib.createRequestWithdrawTransaction(
          userAddress, // feeAndRentPayer
          userAddress, // user
          VAULT_CONFIG.VAULT_NAME,
          currentBatchIndex,
          newWithdrawIndex,
          withdrawShares,
          SystemProgram.programId,
          SYSVAR_RENT_PUBKEY
        );

        // 添加 fee payer 和 recent blockhash
        await vaultLib.addFeePayerAndRecentBlockHashInTransaction(tx, userAddress);
        
        // 使用 AppKit 的 Solana provider 进行签名和发送
        const provider = appKit.getWalletProvider() as any;
        
        if (!provider || !provider.signTransaction) {
          throw new Error("Wallet does not support transaction signing");
        }

        // 通过钱包签名交易
        const signedTx = await provider.signTransaction(tx);
        
        // 发送已签名的交易
        const signature = await connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: false,
          preflightCommitment: VAULT_CONFIG.COMMITMENT,
        });
        
        console.log("Request withdraw transaction signature:", signature);

        // 等待确认
        await connection.confirmTransaction(signature, VAULT_CONFIG.COMMITMENT);

        // 刷新数据
        await fetchUserPosition();
        await fetchVaultData();
        await fetchPendingWithdraws();

        return signature;
      } catch (err: any) {
        console.error("Request withdraw failed:", err);
        setError(err.message || "Withdrawal request failed");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [vaultLib, userAddress, fetchUserPosition, fetchVaultData, fetchPendingWithdraws]
  );

  // Cancel Withdraw 方法（取消提现申请）
  const cancelWithdraw = useCallback(
    async (withdrawIndex: number) => {
      if (!vaultLib || !userAddress) {
        throw new Error("Vault not initialized or user not connected");
      }

      setLoading(true);
      setError(null);

      try {
        const tx = await vaultLib.createCanceledWithdrawTransaction(
          userAddress, // user
          VAULT_CONFIG.VAULT_NAME,
          withdrawIndex
        );

        await vaultLib.addFeePayerAndRecentBlockHashInTransaction(tx, userAddress);

        const connection = createVaultConnection();
        const provider = appKit.getWalletProvider() as any;
        
        if (!provider || !provider.signTransaction) {
          throw new Error("Wallet does not support transaction signing");
        }

        const signedTx = await provider.signTransaction(tx);
        const signature = await connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: false,
          preflightCommitment: VAULT_CONFIG.COMMITMENT,
        });
        
        console.log("Cancel withdraw transaction signature:", signature);

        await connection.confirmTransaction(signature, VAULT_CONFIG.COMMITMENT);

        // 刷新数据
        await fetchUserPosition();
        await fetchPendingWithdraws();

        return signature;
      } catch (err: any) {
        console.error("Cancel withdraw failed:", err);
        setError(err.message || "Cancel withdrawal failed");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [vaultLib, userAddress, fetchUserPosition, fetchPendingWithdraws]
  );

  // Process Withdraw 方法（处理已批准的提款）
  const processWithdraw = useCallback(
    async (withdrawIndex: number) => {
      if (!vaultLib || !userAddress) {
        throw new Error("Vault not initialized or user not connected");
      }

      setLoading(true);
      setError(null);

      try {
        const tx = await vaultLib.createProcessWithdrawTransaction(
          userAddress, // feeAndRentPayer
          userAddress, // user
          VAULT_CONFIG.VAULT_NAME,
          withdrawIndex,
          VAULT_CONFIG.TOKEN_MINT,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
          SystemProgram.programId,
          SYSVAR_RENT_PUBKEY
        );

        await vaultLib.addFeePayerAndRecentBlockHashInTransaction(tx, userAddress);

        // 获取连接
        const connection = createVaultConnection();
        
        // 使用 AppKit 的 Solana provider 进行签名和发送
        const provider = appKit.getWalletProvider() as any;
        
        if (!provider || !provider.signTransaction) {
          throw new Error("Wallet does not support transaction signing");
        }

        // 通过钱包签名交易
        const signedTx = await provider.signTransaction(tx);
        
        // 发送已签名的交易
        const signature = await connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: false,
          preflightCommitment: VAULT_CONFIG.COMMITMENT,
        });
        
        console.log("Process withdraw transaction signature:", signature);

        await connection.confirmTransaction(signature, VAULT_CONFIG.COMMITMENT);

        // 刷新数据
        await fetchUserPosition();
        await fetchVaultData();
        await fetchPendingWithdraws();

        return signature;
      } catch (err: any) {
        console.error("Process withdraw failed:", err);
        setError(err.message || "Process withdrawal failed");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [vaultLib, userAddress, fetchUserPosition, fetchVaultData, fetchPendingWithdraws]
  );

  return {
    vaultLib,
    userAddress,
    vaultData,
    userPosition,
    pendingDeposits,
    pendingWithdraws,
    loading,
    error,
    deposit,
    requestWithdraw,
    cancelWithdraw,
    processWithdraw,
    fetchVaultData,
    fetchUserPosition,
    fetchPendingDeposits,
    fetchPendingWithdraws,
  };
};

