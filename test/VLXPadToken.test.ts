import { expect } from "chai";
import { ethers, waffle, upgrades } from "hardhat";
import { Snapshot, tokens, timeLimit, increaseTime, ether } from "./helpers";

// Artifacts
import VlxArtifact from "../artifacts/contracts/VLXPAD.sol/VLXPAD.json";

// Types
import { VLXPAD, UniswapV2Factory, UniswapV2Router02, WETH9, UniswapV2ERC20} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";

const { deployContract } = waffle;
let factory, router, eth;

describe("VLXPAD Contract Test Suite", () => {
  let vlx: VLXPAD, factory: UniswapV2Factory, eth: WETH9, router: UniswapV2Router02;
  let pair: UniswapV2ERC20;
  let traders: SignerWithAddress[];
  let trader1: SignerWithAddress;
  let trader2: SignerWithAddress;
  let trader3: SignerWithAddress;
  let trader4: SignerWithAddress;
  let feeRewardRecipient: SignerWithAddress;
  let owner: SignerWithAddress;
  let oneMinute: number = 60;
  let oneHour: number = 60 * oneMinute;
  let oneDay: number = oneHour * 24;
  let oneWeek: number = oneDay * 7;
  let oneYear: number = oneDay * 365;

  const snapshot: Snapshot = new Snapshot();
  

  const swapTokens = async (
    amountSold: BigNumber, tokenSold: VLXPAD | WETH9, tokenBought: VLXPAD | WETH9,
    router: UniswapV2Router02, trader: SignerWithAddress
  ) => {
    await tokenSold.connect(trader).approve(router.address, amountSold);
    await router.connect(trader).swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amountSold,
        0,
        [tokenSold.address, tokenBought.address],
        trader.address,
        timeLimit(60)
      );
  };

  before("Deployment Snapshot", async () => {
    let signers: SignerWithAddress[] = await ethers.getSigners();
    owner = signers[0];
    trader1 = signers[1];
    trader2 = signers[2];
    trader3 = signers[3];
    trader4 = signers[4];
    feeRewardRecipient = signers[5];
    traders = [trader1, trader2, trader3, trader4];

    const Factory = await ethers.getContractFactory("UniswapV2Factory");
    factory = (await Factory.deploy(owner.address)) as UniswapV2Factory;
    await factory.deployed();

    const ETH = await ethers.getContractFactory("WETH9");
    eth = (await ETH.deploy()) as WETH9;
    await eth.deployed();

    const ROUTER = await ethers.getContractFactory("UniswapV2Router02");
    router = (await ROUTER.deploy(
      factory.address,
      eth.address
    )) as UniswapV2Router02;
    await router.deployed();

    const Vlx = await ethers.getContractFactory("VLXPAD");

    vlx = (await upgrades.deployProxy( Vlx, [tokens("10000000"), 500, 500, feeRewardRecipient.address, router.address],
      {
        initializer: "initialize",
      }
    )) as VLXPAD;

    await vlx.deployed();

    // Deploy VLXPAD token

    await vlx.mint(owner.address, tokens("10000000"));

    for (const trader of traders) {
      await vlx.transfer(trader.address, tokens("1000000"));
    }

    await owner.sendTransaction({
      to: eth.address,
      value: ether("500")
    });

    await vlx.approve(router.address, tokens("1000000"));
    await eth.approve(router.address, ether("200"));
    await router.addLiquidity(vlx.address, eth.address, tokens("1000000"), ether("200"), 0, 0, owner.address, timeLimit(oneHour));

    let pairAddress: string = await factory.getPair(vlx.address,eth.address);
    pair = await ethers.getContractAt("UniswapV2ERC20", pairAddress);

    // await vlx.setPair(pair.address);
    // Create the VLXPAD, eth pool?
    await snapshot.snapshot();
  });

  afterEach("Revert", async () => {
    await snapshot.revert();
  });

  describe("Deployment", () => {
    it("should be called VELASPAD.io", async () => {
      expect(await vlx.name()).equal("VELASPAD.io");
    });
  });

  describe("Trading", () => {
    it("Should take a 5% fee when selling tokens", async () => {
      let initialBalance: BigNumber = await vlx.balanceOf(pair.address);

      await swapTokens(tokens("100"), vlx, eth, router, trader1);

      expect(await vlx.balanceOf(pair.address)).equal(initialBalance.add(tokens("95")));
    })
  })
});
