import { PublicKey, Connection } from "@solana/web3.js";

// 从环境变量获取 Token Mint 地址，如果没有则使用占位符地址
const getTokenMintAddress = () => {
  const envAddress = import.meta.env.VITE_TOKEN_MINT_ADDRESS;
  if (envAddress) {
    try {
      return new PublicKey(envAddress);
    } catch (error) {
      console.error("Invalid VITE_TOKEN_MINT_ADDRESS:", error);
    }
  }
  // 使用项目的实际 token mint 地址
  // 可以在 .env 文件中设置 VITE_TOKEN_MINT_ADDRESS 来覆盖
  return new PublicKey("EV9BocFxbKU1HtCwCH4jVmizHKNeRJ4USTy6zzgBBa6z");
};

// Vault 配置
export const VAULT_CONFIG = {
  // Vault Program ID
  PROGRAM_ID: new PublicKey("BEgy2zPNRLFFmo3LdpQrW8qyYYjw6NhdF1RwUCLrPh7T"),
  
  // Vault Name
  VAULT_NAME: import.meta.env.VITE_VAULT_NAME || "test-vault-fast",
  
  // RPC 连接
  RPC_ENDPOINT: import.meta.env.VITE_RPC_ENDPOINT || "https://api.testnet.sonic.game",
  WS_ENDPOINT: import.meta.env.VITE_WS_ENDPOINT || "wss://api.testnet.sonic.game",
  
  // Token 配置
  TOKEN_MINT: getTokenMintAddress(),
  TOKEN_DECIMAL: 6,
  DEFAULT_MINT_DECIMAL: 9,
  
  // 交易配置
  COMMITMENT: "confirmed" as const,
  TIME_DELAY: 3000,
  
  // 最小存款金额
  MIN_DEPOSIT_AMOUNT: 10,
};

// 创建连接实例
export const createVaultConnection = () => {
  return new Connection(VAULT_CONFIG.RPC_ENDPOINT, {
    commitment: VAULT_CONFIG.COMMITMENT,
    wsEndpoint: VAULT_CONFIG.WS_ENDPOINT,
  });
};

