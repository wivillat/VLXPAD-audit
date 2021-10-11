import { expect } from "chai";
import { ethers, waffle, upgrades } from "hardhat";
import { Snapshot, tokens, timeLimit, increaseTime, ether, ZeroAddress } from "./helpers";

// Artifacts
import VlxArtifact from "../artifacts/contracts/VLXPAD.sol/VLXPAD.json";

// Types
import { VLXPAD, UniswapV2Factory, UniswapV2Router02, WETH9, UniswapV2Pair} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";

const { deployContract } = waffle;
let factory, router, eth;

describe("VLXPAD Contract Test Suite", () => {
  let vlx: VLXPAD, factory: UniswapV2Factory, eth: WETH9, router: UniswapV2Router02;
  let pair: UniswapV2Pair;
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
    await trader1.sendTransaction({
      to: eth.address,
      value: ether("500")
    });
    await trader2.sendTransaction({
      to: eth.address,
      value: ether("500")
    });
    await trader3.sendTransaction({
      to: eth.address,
      value: ether("500")
    });
    await trader4.sendTransaction({
      to: eth.address,
      value: ether("500")
    });

    // await factory.createPair(vlx.address, eth.address)
    let pairAddress: string = await factory.getPair(vlx.address,eth.address);
    pair = await ethers.getContractAt("UniswapV2Pair", pairAddress);

    await vlx.setPair(pair.address, true);

    let durations = [1200];
    let amountsMax = [tokens("10000")];
    const whitelistAddresses: string[] = [trader1.address, trader2.address]
    
    await vlx.createLGEWhitelist(pair.address, durations, amountsMax);
    await vlx.modifyLGEWhitelist(0, 1200, tokens("10000"), whitelistAddresses, true);

    await vlx.approve(router.address, tokens("1000000"));
    await eth.approve(router.address, ether("200"));
    await router.addLiquidity(vlx.address, eth.address, tokens("1000000"), ether("200"), 0, 0, owner.address, timeLimit(oneHour));

    // let pairAddress: string = await factory.getPair(vlx.address,eth.address);
    // pair = await ethers.getContractAt("UniswapV2Pair", pairAddress);

    // await vlx.setPair(pair.address);
    // Create the VLXPAD, eth pool?
    await snapshot.snapshot();
  });

  afterEach("Revert", async () => {
    await snapshot.revert();
  });

  describe("Deployment", () => {
    it("Should be called VELASPAD.io", async () => {
      expect(await vlx.name()).equal("VELASPAD.io");
    });

    it("Should have the symbol VLXPAD", async () => {
      expect(await vlx.symbol()).equal("VLXPAD");
    });

    it("Should have a cap of 10000000", async () => {
      expect(await vlx.cap()).equal(tokens("10000000"));
    });

    it("Should have 18 decimals", async () => {
      expect(await vlx.decimals()).equal(18);
    });

    it("Should give allowance to a spender of approved amount", async () => {
      await vlx.approve(trader1.address, tokens("1000"));
      // let allowed = await wag.allowance(owner.address, trader1.address);

      expect(await vlx.allowance(owner.address, trader1.address)).equal(tokens("1000"));
    });

    it("Should increase the allowance of a spender", async () => {
        await vlx.increaseAllowance(trader1.address, tokens("2000"));
        expect(await vlx.allowance(owner.address, trader1.address)).equal(tokens("2000"));
    });

    it("Should decrease the allowance of a spender", async () => {
        await vlx.approve(trader1.address, tokens("4000"));
        await vlx.decreaseAllowance(trader1.address, tokens("2000"));
        expect(await vlx.allowance(owner.address, trader1.address)).equal(tokens("2000"));
    });

    it("Should burn tokens", async () => {
        let initialBalance: BigNumber = await vlx.balanceOf(owner.address);
        await vlx.burn(tokens("1000"));
        expect(await vlx.balanceOf(owner.address)).equal(initialBalance.sub(tokens("1000")));
    });

  });

  describe("Trading", () => {
    it("Should take a 5% fee and 5% burn when selling tokens on pancakeswap", async () => {
      let initialBalance: BigNumber = await vlx.balanceOf(pair.address);

      await swapTokens(tokens("100"), vlx, eth, router, trader1);

      // the fee is getting swapped for eth from the pool so the 5% fee ends up staying in the pool
      expect(await vlx.balanceOf(pair.address)).equal(initialBalance.add(tokens("95")));
    });

  });

  describe("allowance", () => {

    it("allowance works as expected", async () => {
      expect(await vlx.allowance(owner.address, trader1.address)).equal(tokens("0"));
      await vlx.approve(trader1.address, tokens("5"));
      expect(await vlx.allowance(owner.address, trader1.address)).equal(tokens("5"));
      await vlx.increaseAllowance(trader1.address, tokens("3"));
      expect(await vlx.allowance(owner.address, trader1.address)).equal(tokens("8"));
      await vlx.decreaseAllowance(trader1.address, tokens("4"));
      expect(await vlx.allowance(owner.address, trader1.address)).equal(tokens("4"));
      await expect(vlx.decreaseAllowance(trader1.address, tokens("5"))).revertedWith("ERC20: decreased allowance below zero");
      expect(await vlx.allowance(owner.address, trader1.address)).equal(tokens("4"));
    });

  });

  describe("approve", () => {

    it("cannot approve the zero address to move your tokens", async () => {
      await expect(vlx.connect(trader1).approve(ZeroAddress, tokens("5"))).to.be.reverted;
    });

    // it("zero address cannot approve burned tokens to be moved", async () => {
    //   const { vlx, holder5, ZeroAddress} = await deployWithTokenHolders();
    //   // Open github issue here
    //   await expect(vlx.connect(ZeroAddress).approve(holder5.address, tokens("5"))).to.be.reverted;
    // });

  });

  describe("transferFrom", () => {

    it("allows you transfer an address' tokens to another address", async () => {
      await vlx.connect(trader1).approve(trader2.address, tokens("5"));
      await vlx.connect(trader2).transferFrom(trader1.address, trader3.address, tokens("5"));
    });

  });

  describe("Ownership", () => {

    it("only the owner can transfer ownership to another address", async () => {
      await expect(vlx.connect(trader1).transferOwnership(trader1.address)).to.be.reverted;
      await vlx.transferOwnership(trader1.address);
      expect(await vlx.owner()).to.be.equal(trader1.address);
    });

    it("owner cannot transfer ownership to the zero address", async () => {
      await expect(vlx.transferOwnership(ZeroAddress)).to.be.reverted;
    });

    it("the owner can renounce ownership of the contract", async () => {
      await vlx.renounceOwnership();
      expect(await vlx.owner()).to.be.equal(ZeroAddress);
    });

  });

  describe("Whitelist", () => {

    it("creating the LGE whitelist requires duration and amountsMax of equal length", async () => {
      let durations = [1200];
      let amountsMax = [tokens("10000"), tokens("10")];

      await expect(vlx.createLGEWhitelist(ZeroAddress, durations, amountsMax)).to.be.reverted;

      durations = [];
      amountsMax = [];

      await vlx.createLGEWhitelist(ZeroAddress, durations, amountsMax); // shouldn't this revert since we're sending it the ZeroAddress?
    });

    it("Adding liquidity activates the whitelist", async () => {
      await swapTokens(ether("1"), eth, vlx, router, trader1);
      await expect(swapTokens(ether("1"), eth, vlx, router, trader3)).to.be.reverted;
    });

    it("transferring tokens reverts if you're not on the whitelist", async () => {
      await expect(swapTokens(ether("1"), eth, vlx, router, trader3)).to.be.reverted;
    });

    it("whitelisters cannot buy more than the specified amount max", async () => {
      await expect(swapTokens(ether("9"), eth, vlx, router, trader3)).to.be.reverted;
    });

    it("whitelist admin can add whitelist addresses using modifyLGEWhitelist", async () => {
      const addresses: string[] = [pair.address, owner.address, trader1.address, trader2.address, trader3.address, trader4.address];
      let data = await vlx.getLGEWhitelistRound();
      expect(data[4]).equal(false);
      await vlx.modifyLGEWhitelist(0, 1200, tokens("5000"), addresses, true);
      data = await vlx.connect(trader3).getLGEWhitelistRound();
      expect(data[4]).equal(true);
    });

    it("whitelist admin can modify the whitelist duration", async () => {
      const addresses: string[] = [pair.address, owner.address, trader1.address, trader2.address, trader3.address, trader4.address];
      await vlx.modifyLGEWhitelist(0, 1201, tokens("5000"), addresses, true);
    });

    it("whitelist admin can modify the max tokens that can be bought during the whitelist", async () => {
      const addresses = [pair.address, owner.address, trader1.address, trader2.address, trader3.address, trader4.address];
      await vlx.modifyLGEWhitelist(0, 1200, tokens("5000"), addresses, true);
    });

    it("whitelist admin can call the modifyLGEWhitelist and not change anything", async () => {
      const addresses = [pair.address, owner.address, trader1.address, trader2.address, trader3.address, trader4.address];
      await vlx.modifyLGEWhitelist(0, 1200, tokens("10000"), addresses, true);
    });

    it("when the whitelist round is over, getLGEWhitelistRound returns 0", async () => {
      let data = await vlx.getLGEWhitelistRound();
      expect(data[0]).to.be.equal(1);
      await increaseTime(1500);
      data = await vlx.getLGEWhitelistRound();
      expect(data[0]).to.be.equal(0);
    });

    it("whitelist admin cannot modify a whitelist that doesn't exist", async () => {
      const addresses = [pair.address, owner.address, trader1.address, trader2.address, trader3.address, trader4.address];
      await expect(vlx.modifyLGEWhitelist(1, 1201, tokens("5000"), addresses, true)).to.be.reverted;
    });

    it("whitelist admin can renounce their whitelister permissions", async () => {
      await vlx.renounceWhitelister();
      expect(await vlx._whitelister()).to.be.equal(ZeroAddress);
    });

    it("whitelist admin can tranfer their whitelisting permission to another address", async () => {
      await expect(vlx.connect(trader1).transferWhitelister(trader1.address)).to.be.reverted;
      await vlx.transferWhitelister(trader1.address);
      expect(await vlx._whitelister()).to.be.equal(trader1.address);
    });

    it("whitelist admin cannot transfer their whitelisting permission to the zero address", async () => {
      await expect(vlx.transferWhitelister(ZeroAddress)).to.be.reverted;
      expect(await vlx._whitelister()).to.be.equal(owner.address);
    });

  });

  describe("Configuration", async () => {
    it("Should allow owner to change the router", async () => {
      await vlx.setRouter(trader1.address);
      expect(await vlx._router()).equal(trader1.address);
    });

    it("Should not let the fees be greater than 100%", async () => {
    let feeRewardSwapPath = [vlx.address, eth.address];   
    await expect(vlx.setFees(6000, 6000, feeRewardSwapPath ,trader1.address)).revertedWith("Fees must not total more than 100%");
    });

    it("Should not let fee reward address be the zero address", async () => {
      let feeRewardSwapPath = [vlx.address, eth.address];   
      await expect(vlx.setFees(1000, 2000, feeRewardSwapPath , ZeroAddress)).revertedWith("Fee reward address must not be zero address");
    });
  });
});
