import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Tabs, Tab } from "@heroui/tabs";
import { Input } from "@heroui/input";
import { useEffect, useState } from "react";

import { PerformanceChart } from "@/components/performance-chart";
import DefaultLayout from "@/layouts/default";
import { appKit } from "@/config/wallet";
import { useVault } from "@/hooks/useVault";

export default function IndexPage() {
  const [mounted, setMounted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawShares, setWithdrawShares] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // 使用 Vault Hook
  const {
    vaultData,
    userPosition,
    pendingDeposits,
    pendingWithdraws,
    error: vaultError,
    deposit,
    requestWithdraw,
    cancelWithdraw,
    processWithdraw,
  } = useVault();

  // 从 Vault 数据中获取真实数据
  const balance = parseFloat(userPosition.balance) || 0;
  const userShares = parseFloat(userPosition.shares) || 0;
  const availableShares = parseFloat(userPosition.availableShares) || 0;
  const sharePrice = parseFloat(vaultData.sharePrice) || 0;

  // 计算函数
  const calculateSharesReceived = (amount: string) => {
    const numAmount = parseFloat(amount) || 0;

    return (numAmount / sharePrice).toFixed(2);
  };

  const calculateUSDCReceived = (shares: string) => {
    const numShares = parseFloat(shares) || 0;

    return (numShares * sharePrice).toFixed(2);
  };

  const handleMaxDeposit = () => {
    setDepositAmount(balance.toString());
  };

  const handleMaxWithdraw = () => {
    setWithdrawShares(userShares.toString());
  };

  // 处理存款
  const handleDeposit = async () => {
    if (!isDepositValid() || isProcessing) return;

    setIsProcessing(true);
    try {
      const signature = await deposit(depositAmount);
      console.log("Deposit successful:", signature);
      
      // 清空输入框
      setDepositAmount("");
      
      // 显示成功消息（可以替换为 toast 组件）
      alert(`Deposit successful!\nTransaction: ${signature}`);
    } catch (err: any) {
      console.error("Deposit error:", err);
      alert(`Deposit failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 处理提款请求
  const handleWithdraw = async () => {

    setIsProcessing(true);
    try {
      const signature = await requestWithdraw(withdrawShares);
      console.log("Withdraw request successful:", signature);
      
      // 清空输入框
      setWithdrawShares("");
      
      // 显示成功消息
      alert(`Withdrawal request successful!\nTransaction: ${signature}\nYour withdrawal will be processed in the next batch.`);
    } catch (err: any) {
      console.error("Withdraw error:", err);
      alert(`Withdrawal request failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 处理已准备好的提现
  const handleProcessWithdraw = async (withdrawIndex: number) => {
    if (isProcessing) return;

    setIsProcessing(true);
    try {
      const signature = await processWithdraw(withdrawIndex);
      console.log("Process withdraw successful:", signature);
      
      alert(`Withdrawal processed successfully!\nTransaction: ${signature}`);
    } catch (err: any) {
      console.error("Process withdraw error:", err);
      alert(`Process withdrawal failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 取消提现申请
  const handleCancelWithdraw = async (withdrawIndex: number) => {
    if (isProcessing) return;

    setIsProcessing(true);
    try {
      const signature = await cancelWithdraw(withdrawIndex);
      console.log("Cancel withdraw successful:", signature);
      
      alert(`Withdrawal request canceled!\nTransaction: ${signature}`);
    } catch (err: any) {
      console.error("Cancel withdraw error:", err);
      alert(`Cancel withdrawal failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 验证函数
  const isDepositValid = () => {
    const amount = parseFloat(depositAmount) || 0;
    return amount >= 10 && amount <= balance && !isProcessing;
  };

  const isWithdrawValid = () => {
    const shares = parseFloat(withdrawShares) || 0;
    return shares > 0 && shares <= availableShares && !isProcessing;
  };

  useEffect(() => {
    setMounted(true);

    // 监听钱包连接状态变化
    const unsubscribe = appKit.subscribeAccount((account) => {
      setIsConnected(!!account?.address);
    });

    return unsubscribe;
  }, []);

  if (!mounted) {
    return (
      <DefaultLayout>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </DefaultLayout>
    );
  }

  if (!isConnected) {
    return (
      <DefaultLayout>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <Card className="max-w-md w-full mx-4">
            <CardBody className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-2xl">S</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Welcome to SVM Vault
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Connect your Solana wallet to start managing your vault
                positions and view your earnings.
              </p>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Please connect your wallet using the button in the top
                navigation.
              </div>
            </CardBody>
          </Card>
        </div>
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto px-4 sm:px-6 py-4 sm:py-8">
          {/* Error Alert */}
          {vaultError && (
            <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
              <p className="font-medium">Error</p>
              <p className="text-sm">{vaultError}</p>
            </div>
          )}
          
          {/* Main Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 lg:gap-8">
            {/* Left Content - 3/4 width */}
            <div className="xl:col-span-3 space-y-6 lg:space-y-8">
              {/* My Position Section */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    My Position
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                  <Card>
                    <CardBody className="p-4 lg:p-6">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        My Balance
                      </div>
                      <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
                        {`${parseFloat(userPosition.balance).toLocaleString()} USDC`}
                      </div>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardBody className="p-4 lg:p-6">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        My Earnings
                      </div>
                      <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
                        {`${parseFloat(userPosition.earnings).toLocaleString()} USDC`}
                      </div>
                    </CardBody>
                  </Card>

                  <Card className="sm:col-span-2 lg:col-span-1">
                    <CardBody className="p-4 lg:p-6">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        My Shares
                      </div>
                      <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
                        {parseFloat(userPosition.shares).toLocaleString()}
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </div>

              {/* Performance Section */}
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 lg:mb-6">
                  Performance
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-6">
                  <Card>
                    <CardBody className="p-6">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        TVL
                      </div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {`$${parseFloat(vaultData.tvl).toLocaleString()}`}
                      </div>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardBody className="p-6">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        APY
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        {`${parseFloat(vaultData.apy).toFixed(2)}%`}
                      </div>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardBody className="p-6">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Share Price
                      </div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {`$${parseFloat(vaultData.sharePrice).toFixed(4)}`}
                      </div>
                    </CardBody>
                  </Card>
                </div>

                {/* Chart Area */}
                <Card>
                  <CardBody className="p-6">
                    <PerformanceChart />
                  </CardBody>
                </Card>
              </div>

              {/* Activity Section */}
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 lg:mb-6">
                  Activity
                </h2>
                <Card>
                  <CardBody className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="border-b border-gray-200 dark:border-gray-700">
                          <tr>
                            <th className="text-left py-4 px-6 text-sm font-medium text-gray-600 dark:text-gray-400">
                              Type
                            </th>
                            <th className="text-left py-4 px-6 text-sm font-medium text-gray-600 dark:text-gray-400">
                              Amount
                            </th>
                            <th className="text-left py-4 px-6 text-sm font-medium text-gray-600 dark:text-gray-400">
                              Status
                            </th>
                            <th className="text-left py-4 px-6 text-sm font-medium text-gray-600 dark:text-gray-400">
                              Batch
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {/* Pending Deposits */}
                          {pendingDeposits.map((deposit) => (
                            <tr key={`deposit-${deposit.depositIndex}`} className="bg-yellow-50/50 dark:bg-yellow-900/10">
                              <td className="py-4 px-6 text-sm text-gray-900 dark:text-white">
                                <div className="flex items-center gap-2">
                                  <span>Pending Deposit</span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    #{deposit.depositIndex}
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-6 text-sm text-gray-900 dark:text-white">
                                {parseFloat(deposit.amount).toLocaleString()} USDC
                                {parseFloat(deposit.fee) > 0 && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Fee: {deposit.fee} USDC
                                  </div>
                                )}
                              </td>
                              <td className="py-4 px-6 text-sm">
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-medium">
                                  ⏳ Processing
                                </span>
                              </td>
                              <td className="py-4 px-6 text-sm text-gray-600 dark:text-gray-400">
                                Batch #{deposit.batchIndex}
                              </td>
                            </tr>
                          ))}
                          
                          {/* Show empty state when no activities */}
                          {pendingDeposits.length === 0 && (
                            <tr>
                              <td colSpan={4} className="py-8 px-6 text-center text-sm text-gray-500 dark:text-gray-400">
                                No activities yet
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </div>

            {/* Right Sidebar - 1/4 width */}
            <div className="xl:col-span-1 order-first xl:order-last">
              <Card>
                <CardBody className="p-4 lg:p-6">
                  <Tabs aria-label="Investment options" className="w-full">
                    <Tab key="deposit" title="Deposit">
                      <div className="space-y-4 pt-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            Deposit USDC
                          </span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            Min: 10 USDC
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            Balance: {balance.toLocaleString()} USDC
                          </div>
                          <Input
                            className="w-full"
                            endContent={
                              <div className="flex items-center gap-2">
                                <button
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                  onClick={handleMaxDeposit}
                                >
                                  MAX
                                </button>
                                <div className="flex items-center gap-1">
                                  <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                                    <span className="text-white text-xs font-bold">
                                      $
                                    </span>
                                  </div>
                                  <span className="text-sm text-gray-900 dark:text-white">
                                    USDC
                                  </span>
                                </div>
                              </div>
                            }
                            label="Amount"
                            labelPlacement="outside"
                            placeholder="0.00"
                            type="number"
                            value={depositAmount}
                            onValueChange={setDepositAmount}
                          />
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">
                              You will receive:
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {calculateSharesReceived(depositAmount)} shares
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">
                              Share price:
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              ${sharePrice}
                            </span>
                          </div>
                        </div>

                        <Button
                          className="w-full"
                          color="primary"
                          isDisabled={!isDepositValid()}
                          isLoading={isProcessing}
                          size="lg"
                          onClick={handleDeposit}
                        >
                          Deposit
                        </Button>

                        {/* Info about pending deposits */}
                        {pendingDeposits.length > 0 && (
                          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <div className="text-xs text-blue-700 dark:text-blue-400">
                              💡 You have {pendingDeposits.length} pending deposit(s). Check the Activity section below for details.
                            </div>
                          </div>
                        )}
                      </div>
                    </Tab>
                    <Tab key="withdraw" title="Withdraw">
                      <div className="space-y-4 pt-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            Withdraw USDC
                          </span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            Available: {availableShares.toLocaleString()} shares
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            Total shares: {userShares.toLocaleString()} | Available: {availableShares.toLocaleString()}
                          </div>
                          <Input
                            className="w-full"
                            endContent={
                              <div className="flex items-center gap-2">
                                <button
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                  onClick={handleMaxWithdraw}
                                >
                                  MAX
                                </button>
                                <span className="text-sm text-gray-900 dark:text-white">
                                  shares
                                </span>
                              </div>
                            }
                            label="Shares to withdraw"
                            labelPlacement="outside"
                            placeholder="0.00"
                            type="number"
                            value={withdrawShares}
                            onValueChange={setWithdrawShares}
                          />
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">
                              You will receive:
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {calculateUSDCReceived(withdrawShares)} USDC
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">
                              Share price:
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              ${sharePrice}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">
                              Processing time:
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              ~24 hours
                            </span>
                          </div>
                        </div>

                        <Button
                          className="w-full"
                          color="warning"
                          isLoading={isProcessing}
                          size="lg"
                          onClick={handleWithdraw}
                        >
                          Request Withdrawal
                        </Button>

                        {/* Pending Withdrawals List */}
                        {pendingWithdraws.length > 0 && (
                          <div className="mt-6 space-y-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              Pending Withdrawals
                            </div>
                            {pendingWithdraws.map((withdraw) => (
                              <div
                                key={withdraw.withdrawIndex}
                                className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2"
                              >
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600 dark:text-gray-400">
                                    Withdraw #{withdraw.withdrawIndex}
                                  </span>
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {withdraw.shares} shares
                                  </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-600 dark:text-gray-400">
                                    {withdraw.isReady ? "Ready to claim" : "Cooldown period"}
                                  </span>
                                  <span className="text-gray-600 dark:text-gray-400">
                                    {withdraw.canWithdrawAt.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex gap-2">
                                  {withdraw.isReady && (
                                    <Button
                                      className="flex-1"
                                      color="success"
                                      isDisabled={isProcessing}
                                      size="sm"
                                      onClick={() => handleProcessWithdraw(withdraw.withdrawIndex)}
                                    >
                                      Claim
                                    </Button>
                                  )}
                                  <Button
                                    className={withdraw.isReady ? "flex-1" : "w-full"}
                                    color="default"
                                    isDisabled={isProcessing}
                                    size="sm"
                                    variant="bordered"
                                    onClick={() => handleCancelWithdraw(withdraw.withdrawIndex)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </Tab>
                  </Tabs>
                </CardBody>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </DefaultLayout>
  );
}
