import { createAppKit } from "@reown/appkit";
import { SolanaAdapter } from "@reown/appkit-adapter-solana";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TrustWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { solanaDevnet } from "@reown/appkit/networks";

// 项目ID - 替换为你的实际项目ID
const projectId =
  import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || "demo-project-id";

// 自定义 Sonic Testnet 网络配置
const sonicTestnet = {
  blockExplorers: {
    default: {
      name: "Solscan",
      url: "https://solscan.io",
    },
  },
  name: "Sonic Testnet",
  nativeCurrency: {
    name: "Sonic",
    symbol: "SOL",
    decimals: 9,
  },
  rpcUrls: {
    default: {
      http: ["https://api.testnet.sonic.game"],
    },
  },
  testnet: true,
  id: "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z",
  chainNamespace: "solana" as const,
  caipNetworkId: "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z" as `solana:${string}`,
  network: "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z",
};

// Solana 适配器配置
const solanaWeb3JsAdapter = new SolanaAdapter({
  wallets: [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new TrustWalletAdapter(),
  ],
});

// 创建 AppKit 实例
export const appKit = createAppKit({
  adapters: [solanaWeb3JsAdapter],
  networks: [sonicTestnet, solanaDevnet],
  projectId,
  metadata: {
    name: "SVM Vault",
    description: "A Solana wallet application",
    url:
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:5173",
    icons: ["/favicon.ico"],
  },
  features: {
    analytics: true,
    email: false,
    socials: [],
  },
});
