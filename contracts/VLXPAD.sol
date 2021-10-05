// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;
 
import "@openzeppelin/contracts-ethereum-package/contracts/utils/SafeCast.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/Address.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "./LGEWhitelisted.sol";
import "hardhat/console.sol";

contract VLXPAD is IERC20, OwnableUpgradeSafe, LGEWhitelisted {
    
    using SafeMath for uint256;
    using Address for address;

    mapping (address => uint256) private _balances;

    mapping (address => mapping (address => uint256)) private _allowances;

    uint256 private _totalSupply;
    
    uint256 private _cap;

    string private _name;
    string private _symbol;
    uint8 private _decimals;
    
    mapping(address => bool) public _feeExcluded;

	uint256 public _feeBurnPct;
	uint256 public _feeRewardPct;
	
	address public _feeRewardAddress;

	mapping(address => bool) public _pair;
	
	address public _router;
	
	address[] public _feeRewardSwapPath;
    
    function initialize(uint256 cap, uint256 feeBurnPct, uint256 feeRewardPct, address feeRewardAddress, address router)
        public
        initializer
    {
        require(cap > 0, "ERC20Capped: cap is 0");
        
        _name = "VELASPAD.io";
        _symbol = "VLXPAD";
        _decimals = 18;
        
        _cap = cap;
        
        __Ownable_init();
		__LGEWhitelisted_init();
		
		IUniswapV2Router02 r = IUniswapV2Router02(router);
		IUniswapV2Factory f = IUniswapV2Factory(r.factory());
		
        setPair(f.createPair(address(this), r.WETH()), true);
        
        address[] memory feeRewardSwapPath = new address[](2);
            
        feeRewardSwapPath[0] = address(this);
        feeRewardSwapPath[1] = r.WETH();
		
		setFees(feeBurnPct, feeRewardPct, feeRewardSwapPath, feeRewardAddress);
		
		_router = router;
		
		setFeeExcluded(_msgSender(), true);
		setFeeExcluded(address(this), true);
    }

    function setRouter(address r) public onlyOwner {
        _router = r;
    }
    
    function setFees(uint256 feeBurnPct, uint256 feeRewardPct, address[] memory feeRewardSwapPath, address feeRewardAddress) public onlyOwner {
        require(feeBurnPct.add(feeRewardPct) <= 10000, "Fees must not total more than 100%");
        require(feeRewardSwapPath.length > 1, "Invalid path");
		require(feeRewardAddress != address(0), "Fee reward address must not be zero address");
		
		_feeBurnPct = feeBurnPct;
		_feeRewardPct = feeRewardPct;
		_feeRewardSwapPath = feeRewardSwapPath;
		_feeRewardAddress = feeRewardAddress;
		
    }

	function setPair(address a, bool pair) public onlyOwner {
        _pair[a] = pair;
    }

	function setFeeExcluded(address a, bool excluded) public onlyOwner {
        _feeExcluded[a] = excluded;
    }
    
    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }
    
    function _beforeTokenTransfer(address sender, address recipient, uint256 amount) internal {
        
		LGEWhitelisted._applyLGEWhitelist(sender, recipient, amount);
		
        if (sender == address(0)) { // When minting tokens
            require(totalSupply().add(amount) <= _cap, "ERC20Capped: cap exceeded");
        }
    }
	
	function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");
		
        _beforeTokenTransfer(sender, recipient, amount);
		
		_balances[sender] = _balances[sender].sub(amount, "ERC20: transfer amount exceeds balance");
		
		if(_pair[recipient] && !_feeExcluded[sender]) {
			
			uint256 feeBurnAmount = 0;
			
			if(_feeBurnPct > 0) {
			
				feeBurnAmount = amount.mul(_feeBurnPct).div(10000);
				
				_cap = _cap.sub(feeBurnAmount);
				_totalSupply = _totalSupply.sub(feeBurnAmount);
				emit Transfer(sender, address(0), feeBurnAmount);
				
			}
			
			uint256 feeRewardAmount = 0;
			
			if(_feeRewardPct > 0 && _feeRewardAddress != address(0))  {
			    
				feeRewardAmount = amount.mul(_feeRewardPct).div(10000);
				
				if(_router != address(0)) {
				    
    				_balances[address(this)] = _balances[address(this)].add(feeRewardAmount);
    				
    				emit Transfer(sender, address(this), feeRewardAmount);
    				
    				IUniswapV2Router02 r = IUniswapV2Router02(_router);
                    
                    _approve(address(this), _router, feeRewardAmount);
    
                    r.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                        feeRewardAmount,
                        0,
                        _feeRewardSwapPath,
                        _feeRewardAddress,
                        block.timestamp
                    );
                
				} else {
				    _balances[_feeRewardAddress] = _balances[_feeRewardAddress].add(feeRewardAmount);
				    emit Transfer(sender, _feeRewardAddress, feeRewardAmount);
				}
				
			}
			console.log(feeBurnAmount);
            console.log(feeRewardAmount);

			amount = amount.sub(feeBurnAmount).sub(feeRewardAmount);
			console.log(amount);
		}

        _balances[recipient] = _balances[recipient].add(amount);
        console.log(_balances[recipient]);
        emit Transfer(sender, recipient, amount);
    }
	
	function burn(uint256 amount) external {
        _cap=_cap.sub(amount);
        _burn(_msgSender(), amount);
    }

    function name() public view returns (string memory) {
        return _name;
    }

    function symbol() public view returns (string memory) {
        return _symbol;
    }

    function cap() public view returns (uint256) {
        return _cap;
    }

    function decimals() public view returns (uint8) {
        return _decimals;
    }

    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    function allowance(address owner, address spender) public view virtual override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) public virtual override returns (bool) {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) public virtual override returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(sender, _msgSender(), _allowances[sender][_msgSender()].sub(amount, "ERC20: transfer amount exceeds allowance"));
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
        _approve(_msgSender(), spender, _allowances[_msgSender()][spender].add(addedValue));
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool) {
        _approve(_msgSender(), spender, _allowances[_msgSender()][spender].sub(subtractedValue, "ERC20: decreased allowance below zero"));
        return true;
    }

    function _mint(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: mint to the zero address");

        _beforeTokenTransfer(address(0), account, amount);

        _totalSupply = _totalSupply.add(amount);
        _balances[account] = _balances[account].add(amount);
        emit Transfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: burn from the zero address");

        _beforeTokenTransfer(account, address(0), amount);

        _balances[account] = _balances[account].sub(amount, "ERC20: burn amount exceeds balance");
        _totalSupply = _totalSupply.sub(amount);
        emit Transfer(account, address(0), amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal virtual {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }
	
}