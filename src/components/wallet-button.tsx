import { Button } from "@heroui/button";
import { useEffect, useState } from "react";

import { appKit } from "@/config/wallet";

export function WalletButton() {
  const [mounted, setMounted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState("");

  useEffect(() => {
    setMounted(true);

    // 监听钱包连接状态变化
    const unsubscribe = appKit.subscribeAccount((account) => {
      setIsConnected(!!account?.address);
      setAddress(account?.address || "");
    });

    return unsubscribe;
  }, []);

  const handleConnect = () => {
    appKit.open();
  };

  const formatAddress = (addr: string) => {
    if (!addr) return "";

    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  if (!mounted) {
    return (
      <Button disabled color="primary" variant="solid">
        连接钱包
      </Button>
    );
  }

  return (
    <Button
      color={isConnected ? "success" : "primary"}
      variant={isConnected ? "bordered" : "solid"}
      onPress={handleConnect}
    >
      {isConnected ? formatAddress(address) : "连接钱包"}
    </Button>
  );
}
