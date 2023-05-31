import type { NextPage } from 'next';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useAccount, useContractRead, useContractWrite, useQuery } from 'wagmi';
import { usePrepareContractWrite } from 'wagmi';
import { BigNumber, constants, utils } from 'ethers';
import lotteryMarketInfo from '../../goerli-deployments/LotteryMarket.json';
import synthetix from '../../goerli-deployments/synthetix/CoreProxy.json';
import linkTokenInfo from '../../goerli-deployments/vrf/linkAggregator/linkToken/Token.json';
import erc20abi from '../erc20.json';
import Header from '../components/Header';
import Section from '../components/Section';

const Home: NextPage = () => {
  const SNXGoerli = '0x51f44ca59b867E005e48FA573Cb8df83FC7f7597';
  const account = useAccount();
  const [luckyNumber, setLuckyNumber] = useState(
    Math.floor(Math.random() * 1000)
  );
  const [progess, setProgress] = useState([
    {
      hasAccount: false,
    },
    { collateralIsApproved: false },
    { depositedCollateral: false },
    { createdPool: false },
    { delegateToPool: false },
    { poolConfigurationIsSet: false },
    { mintedSNXUSD: false },
    { allowToLottery: false },
    { boughtTicket: false },
    { contractHasLink: false },
    { drewANumber: false },
  ]);
  const [error, setError] = useState('');
  const [transactionIsLoading, setTransactionIsLoading] = useState(false);

  // Queries

  const {
    data: accountInformation,
    error: accountQueryError,
    refetch: refetchAccountInformation,
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

  const { data: poolIdData, refetch: refetchPoolIdData } = useQuery(
    ['poolId', account.address],
    async () => {
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
    }
  );

  useEffect(() => {
    if (poolIdData?.data.pools[0]?.id) {
      setProgress((state) => {
        state[3] = { createdPool: true };
        return state;
      });
    }
  }, [poolIdData]);

  const hasAccount =
    !!accountInformation?.data.accounts[0]?.owner && !accountQueryError;

  const userAccountId = accountInformation?.data.accounts[0]?.id;

  useEffect(() => {
    if (hasAccount) {
      setProgress((state) => {
        state[0] = { hasAccount: true };
        return state;
      });
    }
  }, [hasAccount, userAccountId]);

  // READ

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

  useEffect(() => {
    if (snxUSDBalance && (snxUSDBalance as BigNumber).gt(0)) {
      setProgress((state) => {
        state[6] = { mintedSNXUSD: true };
        return state;
      });
    }
  }, [snxUSDBalance]);

  const linkBalance = useContractRead({
    address: linkTokenInfo.address as any,
    abi: linkTokenInfo.abi,
    functionName: 'balanceOf',
    args: [account.address],
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

  useEffect(() => {
    if (
      usdAllowanceToLotteryMarket &&
      (usdAllowanceToLotteryMarket as BigNumber).gt(0)
    ) {
      setProgress((state) => {
        state[7] = { allowToLottery: true };
        return state;
      });
    }
  }, [usdAllowanceToLotteryMarket]);

  const collateralBalance = useContractRead({
    address: SNXGoerli as any,
    abi: erc20abi,
    functionName: 'balanceOf',
    args: [account.address],
  });

  const { data: collateralAllowance, refetch: refetchCollateralAllowance } =
    useContractRead({
      address: SNXGoerli as any,
      abi: erc20abi,
      functionName: 'allowance',
      args: [account.address, synthetix.address],
    });

  useEffect(() => {
    if (!!collateralAllowance && (collateralAllowance as BigNumber).gt(0)) {
      setProgress((state) => {
        state[1] = { collateralIsApproved: true };
        return state;
      });
    }
  }, [collateralAllowance]);

  const {
    data: contractLinkTokenBalance,
    refetch: refetchContractLinkTokenBalance,
  } = useContractRead({
    address: linkTokenInfo.address as any,
    abi: linkTokenInfo.abi,
    functionName: 'balanceOf',
    args: [lotteryMarketInfo.address],
  });

  useEffect(() => {
    if (
      contractLinkTokenBalance &&
      (contractLinkTokenBalance as BigNumber).gt(0)
    ) {
      setProgress((state) => {
        state[9] = { contractHasLink: true };
        return state;
      });
    }
  }, [contractLinkTokenBalance]);

  const {
    data: getAccountAvailableCollateral,
    refetch: refetchGetAccountAvailableCollateral,
  } = useContractRead({
    address: synthetix.address as any,
    abi: synthetix.abi,
    functionName: 'getAccountAvailableCollateral',
    args: [userAccountId, SNXGoerli],
  });

  const { data: getPositionCollateral, refetch: refetchGetPositionCollateral } =
    useContractRead({
      address: synthetix.address as any,
      abi: synthetix.abi,
      functionName: 'getPositionCollateral',
      args: [userAccountId, poolIdData?.data.pools[0]?.id, SNXGoerli],
      enabled: !!poolIdData?.data.pools[0]?.id && !!userAccountId,
    });

  useEffect(() => {
    if (
      getPositionCollateral &&
      (getPositionCollateral as BigNumber[])[0]?.gt(0)
    ) {
      setProgress((state) => {
        state[4] = { delegateToPool: true };
        return state;
      });
    }
  }, [getPositionCollateral]);

  useEffect(() => {
    if (
      getAccountAvailableCollateral &&
      (getAccountAvailableCollateral as BigNumber).gt(0)
    ) {
      setProgress((state) => {
        state[2] = { depositedCollateral: true };
        return state;
      });
    }
    // Available Collateral can be 0 if everything is delegated to Pool
    if (
      getPositionCollateral &&
      (getPositionCollateral as BigNumber[])[0]?.gt(0)
    ) {
      setProgress((state) => {
        state[2] = { depositedCollateral: true };
        return state;
      });
    }
  }, [getAccountAvailableCollateral, getPositionCollateral]);

  // Write

  const createAccount = usePrepareContractWrite({
    address: synthetix.address as any,
    abi: synthetix.abi,
    functionName: 'createAccount',
    args: [luckyNumber],
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

  const sendLinkTokensToContract = usePrepareContractWrite({
    address: linkTokenInfo.address as any,
    abi: linkTokenInfo.abi,
    functionName: 'transfer',
    args: [lotteryMarketInfo.address, utils.parseEther('1')],
  });

  const draw = usePrepareContractWrite({
    address: lotteryMarketInfo.address as any,
    abi: lotteryMarketInfo.abi,
    functionName: 'startDraw',
    enabled:
      !!contractLinkTokenBalance &&
      !!(contractLinkTokenBalance as BigNumber)?.gt(0),
  });

  const sendLinkTokensToContractTx = useContractWrite(
    sendLinkTokensToContract.config
  );
  const drawTx = useContractWrite(draw.config);
  const buyTicketTx = useContractWrite(buyTicket.config);
  const approveSnxUSDToLotteryMarketTx = useContractWrite(approveSnxUSDConfig);
  const mintUSDTx = useContractWrite(mintUSD.config);
  const setPoolConfigurationTx = useContractWrite(setPoolConfiguration.config);
  const delegateCollateralTx = useContractWrite(delegateCollateral.config);
  const createPoolTx = useContractWrite(createPool.config);
  const depositTx = useContractWrite(deposit.config);
  const approveCollateralTx = useContractWrite(approveCollateral.config);
  const createAccountTx = useContractWrite(createAccount.config);

  const marketIdFromPool =
    !!poolIdData?.data.pools[0]?.configurations?.length &&
    poolIdData?.data.pools[0]?.configurations[0]?.market?.id;

  useEffect(() => {
    if (marketIdFromPool) {
      setProgress((state) => {
        state[5] = { poolConfigurationIsSet: true };
        return state;
      });
    }
  }, [marketIdFromPool]);

  return (
    <div className="flex flex-col items-center mb-16">
      <Head>
        <title>Lottery Market</title>
        <meta
          content="Generated by @rainbow-me/create-rainbowkit"
          name="description"
        />
        <link href="/favicon.ico" rel="icon" />
      </Head>
      <Header />

      <h2 className="text-lg font-bold">What are we going to do</h2>
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
        <li>Fund lottery contract with Link token</li>
        <li>Draw a number and see if you won</li>
      </ol>
      <hr className="m-2 w-full" />
      <p>If there is an error, it will appear in the box below</p>
      {error ? (
        <p className="border-4 border-solid rounded p-2 border-red-600 m-2">
          {error}
        </p>
      ) : (
        <p className="border-4 border-solid rounded p-2 border-green-600 m-2">
          No errors
        </p>
      )}
      <hr className="m-2 w-full" />
      <h2 className="text-lg font-bold">Overall information</h2>
      {!!marketId.data ? (
        <p className="p-2 m">Current Market Id: {marketId.data.toString()}</p>
      ) : (
        <p className="p-2 m">Market Id not found, something went wrong</p>
      )}
      {!!getMaxBucketParticipants.data && (
        <p className="p-2 m">
          Maximum of possible participant:{' '}
          {getMaxBucketParticipants.data.toString()}
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

      {!progess[0].hasAccount ? (
        <Section
          isLoading={transactionIsLoading}
          text="You do not have an account yet, please create on"
          buttonText="Create Account"
          onButtonClick={() => {
            setError('');
            if (typeof createAccountTx.writeAsync === 'function') {
              const tx = createAccountTx.writeAsync();
              setTransactionIsLoading(true);
              tx.then((done) =>
                done
                  .wait(2)
                  .then(() =>
                    refetchAccountInformation().then(() =>
                      setTransactionIsLoading(false)
                    )
                  )
              );
            } else {
              setError('Create Account Transaction Transaction failed');
              setTransactionIsLoading(false);
            }
          }}
        />
      ) : (
        <>
          <hr className="m-2 w-full" />
          <p>Your Account ID is: {userAccountId}</p>
        </>
      )}
      {progess[0].hasAccount ? (
        !progess[1].collateralIsApproved ? (
          <Section
            isLoading={transactionIsLoading}
            text="Approve Collateral to deposit into your account"
            buttonText="Approve Collateral"
            onButtonClick={() => {
              setError('');
              if (typeof approveCollateralTx.writeAsync === 'function') {
                const tx = approveCollateralTx.writeAsync();
                setTransactionIsLoading(true);
                tx.then((done) =>
                  done
                    .wait(1)
                    .then(() =>
                      refetchCollateralAllowance().then(() =>
                        setTransactionIsLoading(false)
                      )
                    )
                );
              } else {
                setError('Create Account Transaction Transaction failed');
                setTransactionIsLoading(false);
              }
            }}
          />
        ) : (
          <>
            <hr className="m-2 w-full" />
            <p>
              Collateral Allowance for Synthetix Core System: ${' '}
              {collateralAllowance
                ? utils.formatEther(collateralAllowance as BigNumber)
                : 0}
            </p>
          </>
        )
      ) : (
        <></>
      )}

      {progess[1].collateralIsApproved ? (
        !progess[2].depositedCollateral ? (
          <Section
            isLoading={transactionIsLoading}
            text="Now we are going to deposit 20 SNX into your account"
            buttonText="Deposit Collateral"
            onButtonClick={() => {
              setError('');
              setTransactionIsLoading(true);
              if (typeof depositTx.writeAsync === 'function') {
                const tx = depositTx.writeAsync();
                tx.then((done) =>
                  done
                    .wait(1)
                    .then(() =>
                      refetchGetAccountAvailableCollateral().then(() =>
                        setTransactionIsLoading(false)
                      )
                    )
                );
              } else {
                setError('Deposit Transaction failed');
                setTransactionIsLoading(false);
              }
            }}
          />
        ) : (
          <>
            <hr className="m-2 w-full" />
            <p>
              Amount of deposited collateral (SNX):{' '}
              {!!getAccountAvailableCollateral
                ? utils.formatEther(getAccountAvailableCollateral as BigNumber)
                : 0}
            </p>
          </>
        )
      ) : (
        <></>
      )}

      {progess[2].depositedCollateral ? (
        !progess[3].createdPool ? (
          <Section
            isLoading={transactionIsLoading}
            text="Now you need to create a pool in order to provide snxUSD to the market"
            buttonText="Create Pool"
            onButtonClick={() => {
              setError('');
              setTransactionIsLoading(true);
              if (typeof createPoolTx.writeAsync === 'function') {
                const tx = createPoolTx.writeAsync();
                tx.then((done) =>
                  done
                    .wait(2)
                    .then(() =>
                      refetchPoolIdData().then(() =>
                        setTransactionIsLoading(false)
                      )
                    )
                );
              } else {
                setError('Create Pool Transaction failed');
                setTransactionIsLoading(false);
              }
            }}
          />
        ) : (
          <>
            <hr className="m-2 w-full" />
            <p>Your Pool Id: {poolIdData?.data.pools[0]?.id.toString()}</p>
          </>
        )
      ) : (
        <></>
      )}

      {progess[3].createdPool ? (
        !progess[4].delegateToPool ? (
          <Section
            isLoading={transactionIsLoading}
            text="Now we are going to delegate this collateral to the pool"
            buttonText="Delegate Collateral To Pool"
            onButtonClick={() => {
              setError('');
              setTransactionIsLoading(true);
              if (typeof delegateCollateralTx.writeAsync === 'function') {
                const tx = delegateCollateralTx.writeAsync();
                tx.then((done) =>
                  done
                    .wait(1)
                    .then(() =>
                      refetchGetPositionCollateral().then(() =>
                        setTransactionIsLoading(false)
                      )
                    )
                );
              } else {
                setError('Delegate Collateral To Pool Transaction failed');
                setTransactionIsLoading(false);
              }
            }}
          />
        ) : (
          <>
            <hr className="m-2 w-full" />
            <p>
              Your delegated Collateral to your Pool:&nbsp;
              {utils.formatEther((getPositionCollateral as BigNumber[])[0])} SNX
            </p>
          </>
        )
      ) : (
        <></>
      )}

      {progess[4].delegateToPool ? (
        !progess[5].poolConfigurationIsSet ? (
          <Section
            isLoading={transactionIsLoading}
            text="Now we need to configure your Pool to support the Market with snxUSD"
            buttonText="Set Pool Configuration"
            onButtonClick={() => {
              setError('');
              setTransactionIsLoading(true);
              if (typeof setPoolConfigurationTx.writeAsync === 'function') {
                const tx = setPoolConfigurationTx.writeAsync();
                tx.then((done) =>
                  done
                    .wait(2)
                    .then(() =>
                      refetchPoolIdData().then(() =>
                        setTransactionIsLoading(false)
                      )
                    )
                );
              } else {
                setError('Set Pool Configuration Transaction failed');
                setTransactionIsLoading(false);
              }
            }}
          />
        ) : (
          <>
            <hr className="m-2 w-full" />
            <p>Pool configuration is set</p>
          </>
        )
      ) : (
        <></>
      )}

      {progess[5].poolConfigurationIsSet ? (
        !progess[6].mintedSNXUSD ? (
          <Section
            isLoading={transactionIsLoading}
            text="Your Pool supports now the market. Now we need you to get some
            snxUSD to buy tickets for the lottery. We will mint against your
            collateral and get you 4 snxUSD"
            buttonText="Mint snxUSD"
            onButtonClick={() => {
              setError('');
              setTransactionIsLoading(true);
              if (typeof mintUSDTx.writeAsync === 'function') {
                const tx = mintUSDTx.writeAsync();
                tx.then((done) =>
                  done
                    .wait(1)
                    .then(() =>
                      refetchSnxUSDBalance().then(() =>
                        setTransactionIsLoading(false)
                      )
                    )
                );
              } else {
                setError('Mint USD Transaction failed');
                setTransactionIsLoading(false);
              }
            }}
          />
        ) : (
          <></>
        )
      ) : (
        <></>
      )}

      {progess[6].mintedSNXUSD ? (
        !progess[7].allowToLottery ? (
          <Section
            isLoading={transactionIsLoading}
            text="Approve the lottery market to spent your snxUSD in order to buy a ticket"
            buttonText="Allowance to Lottery"
            onButtonClick={() => {
              setError('');
              setTransactionIsLoading(true);
              if (
                typeof approveSnxUSDToLotteryMarketTx.writeAsync === 'function'
              ) {
                const tx = approveSnxUSDToLotteryMarketTx.writeAsync();
                tx.then((done) =>
                  done
                    .wait(1)
                    .then(() =>
                      refetchUsdAllowanceToLotteryMarket().then(() =>
                        setTransactionIsLoading(false)
                      )
                    )
                );
              } else {
                setError('Allowance To Lottery Transaction failed');
                setTransactionIsLoading(false);
              }
            }}
          />
        ) : (
          <></>
        )
      ) : (
        <></>
      )}

      {progess[7].allowToLottery ? (
        !progess[8].boughtTicket ? (
          <Section
            isLoading={transactionIsLoading}
            text="Now we are ready to buy a ticket"
            buttonText="Buy Ticket (can be executed many times)"
            onButtonClick={() => {
              setError('');
              setTransactionIsLoading(true);
              if (typeof buyTicketTx.writeAsync === 'function') {
                const tx = buyTicketTx.writeAsync();
                tx.then((done) =>
                  done.wait(1).then(() => {
                    setProgress((state) => {
                      state[8] = { boughtTicket: true };
                      return state;
                    });
                    setTransactionIsLoading(false);
                  })
                );
              } else {
                setError('Buy Ticket Transaction failed');
                setTransactionIsLoading(false);
              }
            }}
          />
        ) : (
          <>
            <hr className="m-2 w-full" />
            <p>Ticket Bought</p>
          </>
        )
      ) : (
        <></>
      )}

      {progess[8].boughtTicket ? (
        !progess[9].contractHasLink ? (
          <Section
            isLoading={transactionIsLoading}
            text="Your Contract needs Link tokens so request a random number. Make
              sure you to get some LINK Tokens from the faucet: https://faucets.chain.link/goerli"
            buttonText="Send 1 Link to Lottery"
            onButtonClick={() => {
              setError('');
              setTransactionIsLoading(true);
              if (typeof sendLinkTokensToContractTx.writeAsync === 'function') {
                const tx = sendLinkTokensToContractTx.writeAsync();
                tx.then((done) =>
                  done.wait(1).then(() => {
                    refetchContractLinkTokenBalance().then(() => {
                      setTransactionIsLoading(false);
                    });
                  })
                );
              } else {
                setError('Send Link To Lottery Contract Transaction failed');
                setTransactionIsLoading(false);
              }
            }}
          />
        ) : (
          <></>
        )
      ) : (
        <></>
      )}

      {progess[9].contractHasLink ? (
        <Section
          isLoading={transactionIsLoading}
          text="Draw a random number"
          buttonText="Draw a number (can be executed many times)"
          onButtonClick={() => {
            setError('');
            setTransactionIsLoading(true);
            if (typeof drawTx.writeAsync === 'function') {
              const tx = drawTx.writeAsync();
              tx.then((done) =>
                done.wait(1).then(() => {
                  setTransactionIsLoading(false);
                })
              );
            } else {
              setError('Draw Transaction failed');
              setTransactionIsLoading(false);
            }
          }}
        />
      ) : (
        <></>
      )}
    </div>
  );
};

export default Home;
