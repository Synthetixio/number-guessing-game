import type { NextPage } from 'next';
import Head from 'next/head';
import { useState } from 'react';
import { useAccount, useContractRead, useContractWrite, useQuery } from 'wagmi';
import { usePrepareContractWrite } from 'wagmi';
import { BigNumber, constants, utils } from 'ethers';
import lotteryMarketInfo from '../../goerli-deployments/LotteryMarket.json';
import synthetix from '../../goerli-deployments/synthetix/CoreProxy.json';
import linkTokenInfo from '../../goerli-deployments/vrf/linkAggregator/linkToken/Token.json';
import erc20abi from '../erc20.json';
import Header from '../components/Header';

const Home: NextPage = () => {
  const [luckyNumber, setLuckyNumber] = useState(
    Math.floor(Math.random() * 1000)
  );

  const [error, setError] = useState('');

  const [accountTxIsLoading, setAccountTxIsLoading] = useState(false);
  const [poolIdIsLoading, setPoolIdTxIsLoading] = useState(false);

  const SNXGoerli = '0x51f44ca59b867E005e48FA573Cb8df83FC7f7597';

  const account = useAccount();

  const {
    data: accountInformation,
    error: accountQueryError,
    isLoading,
    refetch,
  } = useQuery(['accountID', account.address], async () => {
    const response = await fetch(
      'https://api.thegraph.com/subgraphs/name/snx-v3/goerli',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
        query accounts($address: String) {
          accounts(where: {owner: $address }) {
            id
            owner
        }
      }
      `,
          variables: {
            address: account.address?.toLowerCase(),
          },
        }),
      }
    );
    return await response.json();
  });

  const {
    data: poolIdData,
    refetch: refetchPoolIdData,
    isLoading: poolIdDataIsLoading,
  } = useQuery(['poolId', account.address], async () => {
    const response = await fetch(
      'https://api.thegraph.com/subgraphs/name/snx-v3/goerli',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
        query poolId($address: String) {
          pools(where:{owner: $address} orderBy: created_at orderDirection: desc) {
            id
            owner
            created_at
            configurations {
              market{ 
                id
              }
            }
        }
      }
      `,
          variables: {
            address: account.address?.toLowerCase(),
          },
        }),
      }
    );
    return await response.json();
  });

  const hasAccount =
    !!accountInformation?.data.accounts[0]?.owner && !accountQueryError;

  const userAccountId = accountInformation?.data.accounts[0]?.id;

  const marketId = useContractRead({
    address: lotteryMarketInfo.address as any,
    abi: lotteryMarketInfo.abi,
    functionName: 'marketId',
  });

  const getMaxBucketParticipants = useContractRead({
    address: lotteryMarketInfo.address as any,
    abi: lotteryMarketInfo.abi,
    functionName: 'getMaxBucketParticipants',
  });

  const getWithdrawableMarketUsd = useContractRead({
    address: synthetix.address as any,
    abi: synthetix.abi,
    functionName: 'getWithdrawableMarketUsd',
    args: [marketId.data],
    enabled: !!marketId.data,
  });

  const jackpotValue = useContractRead({
    address: lotteryMarketInfo.address as any,
    abi: lotteryMarketInfo.abi,
    functionName: 'jackpot',
  });

  const snxUSDAddress = useContractRead({
    address: synthetix.address as any,
    abi: synthetix.abi,
    functionName: 'getUsdToken',
  });

  const { data: snxUSDBalance, refetch: refetchSnxUSDBalance } =
    useContractRead({
      address: snxUSDAddress.data as any,
      abi: erc20abi,
      functionName: 'balanceOf',
      args: [account.address],
      enabled: !!snxUSDAddress.data,
    });

  const linkBalance = useContractRead({
    address: linkTokenInfo.address as any,
    abi: linkTokenInfo.abi,
    functionName: 'balanceOf',
    args: [account.address],
  });

  const createAccount = usePrepareContractWrite({
    address: synthetix.address as any,
    abi: synthetix.abi,
    functionName: 'createAccount',
    args: [luckyNumber],
  });

  const {
    data: usdAllowanceToLotteryMarket,
    refetch: refetchUsdAllowanceToLotteryMarket,
  } = useContractRead({
    address: snxUSDAddress.data as any,
    abi: erc20abi,
    functionName: 'allowance',
    args: [account.address, lotteryMarketInfo.address],
  });

  const collateralBalance = useContractRead({
    address: SNXGoerli as any,
    abi: erc20abi,
    functionName: 'balanceOf',
    args: [account.address],
  });

  const collateralAllowance = useContractRead({
    address: SNXGoerli as any,
    abi: erc20abi,
    functionName: 'allowance',
    args: [account.address, synthetix.address],
  });

  const approveCollateral = usePrepareContractWrite({
    address: SNXGoerli as any,
    abi: erc20abi,
    functionName: 'approve',
    args: [synthetix.address, constants.MaxUint256],
  });

  const deposit = usePrepareContractWrite({
    address: synthetix.address as any,
    abi: synthetix.abi,
    functionName: 'deposit',
    args: [userAccountId, SNXGoerli, utils.parseEther('20')],
    enabled: !!userAccountId,
  });

  const {
    data: getAccountAvailableCollateral,
    refetch: refetchGetAccountAvailableCollateral,
  } = useContractRead({
    address: synthetix.address as any,
    abi: synthetix.abi,
    functionName: 'getAccountAvailableCollateral',
    args: [userAccountId, SNXGoerli],
  });

  const createPool = usePrepareContractWrite({
    address: synthetix.address as any,
    abi: synthetix.abi,
    functionName: 'createPool',
    args: [luckyNumber, account.address],
    enabled: !!account.address,
  });

  const delegateCollateral = usePrepareContractWrite({
    address: synthetix.address as any,
    abi: synthetix.abi,
    functionName: 'delegateCollateral',
    args: [
      userAccountId,
      poolIdData?.data.pools[0]?.id,
      SNXGoerli,
      utils.parseEther('20'),
      utils.parseEther('1'),
    ],
    enabled: !!userAccountId && !!poolIdData?.data.pools[0]?.id,
  });

  const { data: getPositionCollateral, refetch: refetchGetPositionCollateral } =
    useContractRead({
      address: synthetix.address as any,
      abi: synthetix.abi,
      functionName: 'getPositionCollateral',
      args: [userAccountId, poolIdData?.data.pools[0]?.id, SNXGoerli],
      enabled: !!poolIdData?.data.pools[0]?.id && !!userAccountId,
    });

  const setPoolConfiguration = usePrepareContractWrite({
    address: synthetix.address as any,
    abi: synthetix.abi,
    functionName: 'setPoolConfiguration',
    args: [
      poolIdData?.data.pools[0]?.id,
      [
        {
          marketId: marketId?.data?.toString(),
          weightD18: utils.parseEther('1'),
          maxDebtShareValueD18: utils.parseEther('1'),
        },
      ],
    ],
    enabled:
      !!userAccountId && !!poolIdData?.data.pools[0]?.id && !!marketId?.data,
  });

  const mintUSD = usePrepareContractWrite({
    address: synthetix.address as any,
    abi: synthetix.abi,
    functionName: 'mintUsd',
    args: [
      userAccountId,
      poolIdData?.data.pools[0]?.id,
      SNXGoerli,
      utils.parseEther('4'),
    ],
    enabled: !!userAccountId && !!poolIdData?.data.pools[0]?.id,
  });

  const { config: approveSnxUSDConfig } = usePrepareContractWrite({
    address: snxUSDAddress.data as any,
    abi: erc20abi,
    functionName: 'approve',
    args: [lotteryMarketInfo.address, constants.MaxUint256],
    enabled: !!snxUSDAddress.data,
  });

  const buyTicket = usePrepareContractWrite({
    address: lotteryMarketInfo.address as any,
    abi: lotteryMarketInfo.abi,
    functionName: 'buy',
    args: [account.address, luckyNumber],
    enabled: !!(snxUSDBalance as BigNumber)?.gt(0),
  });

  // const drawPrepare = usePrepareContractWrite({
  //   address: lotteryMarketInfo.address as any,
  //   abi: lotteryMarketInfo.abi,
  //   functionName: 'startDraw',
  //   args: [ethers.utils.parseEther('2')],
  //   enabled: !!usdBalance.data && (usdBalance.data as BigNumber)?.gt(0),
  // });

  const {
    data: contractLinkTokenBalance,
    refetch: refetchContractLinkTokenBalance,
  } = useContractRead({
    address: linkTokenInfo.address as any,
    abi: linkTokenInfo.abi,
    functionName: 'balanceOf',
    args: [lotteryMarketInfo.address],
  });

  const buyTicketTx = useContractWrite(buyTicket.config);
  const approveSnxUSDToLotteryMarketTx = useContractWrite(approveSnxUSDConfig);
  const mintUSDTx = useContractWrite(mintUSD.config);
  const setPoolConfigurationTx = useContractWrite(setPoolConfiguration.config);
  const delegateCollateralTx = useContractWrite(delegateCollateral.config);
  const createPoolTx = useContractWrite(createPool.config);
  const depositTx = useContractWrite(deposit.config);
  const approveCollateralTx = useContractWrite(approveCollateral.config);
  const createAccountTx = useContractWrite(createAccount.config);

  return (
    <div className="flex flex-col items-center mb-8">
      <Head>
        <title>Lottery Market</title>
        <meta
          content="Generated by @rainbow-me/create-rainbowkit"
          name="description"
        />
        <link href="/favicon.ico" rel="icon" />
      </Head>
      <Header />

      <h2>What are we going to do</h2>
      <ol className="list-decimal">
        <li>Create an account for you</li>
        <li>Approve the collateral to be deposited into your account</li>
        <li>Deposit collateral into your account</li>
        <li>Create a pool</li>
        <li>Delegate the collateral to the pool</li>
        <li>Configure the pool to support the market</li>
        <li>Mint against your collateral to get snxUSD</li>
        <li>Allow the lottery to spent your snxUSD</li>
        <li>Buy a ticket for the lottery</li>
        <li>Draw a number and see if you won</li>
      </ol>

      {error && <p className="border border-solid border-red-400">{error}</p>}
      {!!marketId.data ? (
        <p className="p-2 m">Current Market Id: {marketId.data.toString()}</p>
      ) : (
        <p className="p-2 m">Market Id not found, something went wrong</p>
      )}
      {!!getMaxBucketParticipants.data && (
        <p className="p-2 m">
          Maximum of participant: {getMaxBucketParticipants.data.toString()}
        </p>
      )}
      {!!getWithdrawableMarketUsd.data && (
        <p className="p-2 m">
          Amount of USD in Market: $&nbsp;
          {utils.formatEther(getWithdrawableMarketUsd.data as BigNumber)}
        </p>
      )}
      {!!jackpotValue.data && (
        <p className="p-2 m">
          Jackpot: $ {utils.formatEther(jackpotValue.data as BigNumber)}
        </p>
      )}
      <hr className="m-2 w-full" />
      {!!snxUSDBalance && (
        <p className="p-2 m">
          snxUSD: $ {utils.formatEther(snxUSDBalance as BigNumber)}
        </p>
      )}
      {!!usdAllowanceToLotteryMarket && (
        <p className="p-2 m">
          snxUSD allowance to lottery market: ${' '}
          {utils.formatEther(usdAllowanceToLotteryMarket as BigNumber)}
        </p>
      )}
      {!!linkBalance.data && (
        <p className="p-2 m">
          LINK: {utils.formatEther(linkBalance.data as BigNumber)}
        </p>
      )}

      {!!contractLinkTokenBalance && (
        <p className="p-2 m">
          LINK Balance of Lottery Contract:{' '}
          {utils.formatEther(contractLinkTokenBalance as BigNumber)}
        </p>
      )}
      {!!collateralBalance.data && (
        <p className="p-2 m">
          SNX Balance (SNX):{' '}
          {utils.formatEther(collateralBalance.data as BigNumber)}
        </p>
      )}
      <hr className="m-2 w-full" />
      <p>
        {isLoading || accountTxIsLoading ? (
          'Loading Account information...'
        ) : hasAccount ? (
          `Your account id: ${userAccountId}`
        ) : (
          <section className="flex flex-col items-center">
            <p>You do not have an account yet, please create on</p>
            <button
              className="border border-solid border-green-300 rounded p-2 bg-green-200 m-2"
              onClick={() => {
                setError('');
                if (typeof createAccountTx.writeAsync === 'function') {
                  const tx = createAccountTx.writeAsync();
                  setAccountTxIsLoading(true);
                  tx.then((done) =>
                    done
                      .wait(2)
                      .then(() =>
                        refetch().then(() => setAccountTxIsLoading(false))
                      )
                  );
                } else {
                  setError('Create Account Transaction can not be executed');
                  setAccountTxIsLoading(false);
                }
              }}
            >
              Create Account
            </button>
          </section>
        )}
      </p>
      <hr className="m-2 w-full" />
      <section className="flex flex-col items-center">
        {hasAccount && (collateralBalance.data as BigNumber)?.gt(0) ? (
          (collateralAllowance?.data as BigNumber).eq(0) ? (
            <>
              <p className="m p-2">
                Approve Collateral to deposit into your account
              </p>
              <button
                className="border border-solid border-green-300 rounded p-2 bg-green-200 "
                onClick={() => {
                  setError('');
                  if (typeof approveCollateralTx.writeAsync === 'function') {
                    const tx = approveCollateralTx.writeAsync();
                    tx.then((done) => done.wait(1));
                  } else {
                    setError('Approve Transaction failed');
                  }
                }}
              >
                Approve Collateral
              </button>
            </>
          ) : (
            <p>
              Collateral Allowance for Synthetix Core System: ${' '}
              {utils.formatEther(collateralAllowance.data as BigNumber)}
            </p>
          )
        ) : (
          <p className="m p-2">
            You do not have any collateral, please get some SNX on Goerli
          </p>
        )}
      </section>
      <hr className="m-2 w-full" />
      <section className="flex flex-col items-center">
        {hasAccount &&
          (collateralBalance.data as BigNumber)?.gt(0) &&
          (collateralAllowance.data as BigNumber).gt(0) &&
          !(getAccountAvailableCollateral as BigNumber)?.gt(0) && (
            <>
              <p className="m p-2">
                Now we are going to deposit 20 SNX into your account
              </p>
              <button
                className="border border-solid border-green-300 rounded p-2 bg-green-200 "
                onClick={() => {
                  setError('');
                  if (typeof depositTx.writeAsync === 'function') {
                    const tx = depositTx.writeAsync();
                    tx.then((done) =>
                      done
                        .wait(1)
                        .then(() => refetchGetAccountAvailableCollateral())
                    );
                  } else {
                    setError('Deposit Transaction failed');
                  }
                }}
              >
                Deposit Collateral
              </button>
            </>
          )}
      </section>
      {(getAccountAvailableCollateral as BigNumber)?.gt(0) && (
        <section className="p-2 ,">
          Amount of deposited collateral (SNX):{' '}
          {utils.formatEther(getAccountAvailableCollateral as BigNumber)}
        </section>
      )}
      <hr className="m-2 w-full" />
      {(getAccountAvailableCollateral as BigNumber)?.gt(0) && hasAccount && (
        <section className="flex flex-col items-center">
          {!poolIdData?.data?.pools[0]?.id && (
            <p className="p-2 m">
              Now you need to create a pool in order to provide snxUSD to the
              market
            </p>
          )}
          {poolIdIsLoading ? (
            'Loading Pool...'
          ) : poolIdData?.data.pools[0]?.id ? (
            <p>Your Pool Id: {poolIdData?.data.pools[0]?.id.toString()}</p>
          ) : (
            <button
              className="border border-solid border-green-300 rounded p-2 bg-green-200 "
              onClick={() => {
                setError('');
                setPoolIdTxIsLoading(true);
                if (typeof createPoolTx.writeAsync === 'function') {
                  const tx = createPoolTx.writeAsync();
                  tx.then((done) =>
                    done.wait(2).then(() =>
                      refetchPoolIdData().then(() => {
                        setPoolIdTxIsLoading(false);
                      })
                    )
                  );
                } else {
                  setError('Create Pool Transaction failed');
                  setPoolIdTxIsLoading(false);
                }
              }}
            >
              Create Pool
            </button>
          )}
        </section>
      )}
      <hr className="m-2 w-full" />
      {getPositionCollateral &&
      (getPositionCollateral as BigNumber[])[0]?.gt(0) ? (
        <section>
          <p>
            Your delegated Collateral to your Pool:&nbsp;
            {utils.formatEther((getPositionCollateral as BigNumber[])[0])} SNX
          </p>
        </section>
      ) : (
        (getAccountAvailableCollateral as BigNumber)?.gt(0) &&
        !!poolIdData?.data.pools[0]?.id &&
        hasAccount && (
          <section className="flex flex-col items-center m-2 p-2">
            <p className="p-2 m">
              Now we are going to delegate this collateral to the pool
            </p>
            <button
              className="border border-solid border-green-300 rounded p-2 bg-green-200 "
              onClick={() => {
                setError('');
                if (typeof delegateCollateralTx.writeAsync === 'function') {
                  const tx = delegateCollateralTx.writeAsync();
                  tx.then((done) =>
                    done.wait(1).then(() => refetchGetPositionCollateral())
                  );
                } else {
                  setError('Delegate Collateral To Pool Transaction failed');
                }
              }}
            >
              Delegate Collateral To Pool
            </button>
          </section>
        )
      )}
      <hr className="m-2 w-full" />
      {!!getPositionCollateral &&
        !(
          (poolIdData?.data.pools[0]?.configurations[0]?.market
            ?.id as string) ===
          ((marketId.data as BigNumber).toString() as string)
        ) &&
        (getPositionCollateral as BigNumber[])[0]?.gt(0) && (
          <section className="flex flex-col items-center">
            <p className="p-2 m">
              Now we need to configure your Pool to support the Market with
              snxUSD
            </p>
            <button
              className="border border-solid border-green-300 rounded p-2 bg-green-200 "
              onClick={() => {
                setError('');
                if (typeof setPoolConfigurationTx.writeAsync === 'function') {
                  const tx = setPoolConfigurationTx.writeAsync();
                  tx.then((done) =>
                    done.wait(2).then(() => refetchPoolIdData())
                  );
                } else {
                  setError('Set Pool Configuration Transaction failed');
                }
              }}
            >
              Set Pool Configuration
            </button>
          </section>
        )}
      {poolIdData?.data.pools[0]?.configurations[0]?.market?.id &&
        !(snxUSDBalance as BigNumber)?.gt(0) && (
          <section className="flex flex-col items-center">
            <p className="p-2 m">
              Your Pool supports now the market. Now we need you to get some
              snxUSD to buy tickets for the lottery. We will mint against your
              collateral and get you 4 snxUSD
            </p>
            <button
              className="border border-solid border-green-300 rounded p-2 bg-green-200 "
              onClick={() => {
                setError('');
                if (typeof mintUSDTx.writeAsync === 'function') {
                  const tx = mintUSDTx.writeAsync();
                  tx.then((done) =>
                    done.wait(1).then(() => refetchSnxUSDBalance())
                  );
                } else {
                  setError('Mint USD Transaction failed');
                }
              }}
            >
              Mint snxUSD
            </button>
          </section>
        )}
      {(snxUSDBalance as BigNumber)?.gt(0) &&
        !(usdAllowanceToLotteryMarket as BigNumber)?.gt(0) && (
          <section className="flex flex-col items-center">
            <p className="p-2 m">
              Approve the lottery market to spent your snxUSD in order to buy a
              ticket
            </p>
            <button
              className="border border-solid border-green-300 rounded p-2 bg-green-200 "
              onClick={() => {
                setError('');
                if (
                  typeof approveSnxUSDToLotteryMarketTx.writeAsync ===
                  'function'
                ) {
                  const tx = approveSnxUSDToLotteryMarketTx.writeAsync();
                  tx.then((done) =>
                    done
                      .wait(1)
                      .then(() => refetchUsdAllowanceToLotteryMarket())
                  );
                } else {
                  setError('Mint USD Transaction failed');
                }
              }}
            >
              Allow Lottery Market to spent snxUSD
            </button>
          </section>
        )}

      {(snxUSDBalance as BigNumber)?.gt(0) &&
        (usdAllowanceToLotteryMarket as BigNumber)?.gt(0) && (
          <section className="flex flex-col items-center">
            <p className="p-2 m">Now we are ready to buy a ticket</p>
            <button
              className="border border-solid border-green-300 rounded p-2 bg-green-200 "
              onClick={() => {
                setError('');
                if (typeof buyTicketTx.writeAsync === 'function') {
                  const tx = buyTicketTx.writeAsync();
                  tx.then((done) =>
                    done
                      .wait(1)
                      .then(() => refetchUsdAllowanceToLotteryMarket())
                  );
                } else {
                  setError('Buy Ticket Transaction failed');
                }
              }}
            >
              Buy Ticket
            </button>
          </section>
        )}
    </div>
  );
};

export default Home;
