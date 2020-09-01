pragma solidity ^0.5.0;

interface IERC20 {
    function transfer(address to, uint tokens) external returns (bool success);
    function transferFrom(address from, address to, uint tokens) external returns (bool success);
    function balanceOf(address tokenOwner) external view returns (uint balance);
    function approve(address spender, uint tokens) external returns (bool success);
    function allowance(address tokenOwner, address spender) external view returns (uint remaining);
    function totalSupply() external view returns (uint);
    event Transfer(address indexed from, address indexed to, uint tokens);
    event Approval(address indexed tokenOwner, address indexed spender, uint tokens);
}

library SafeMath {
    function add(uint a, uint b) internal pure returns (uint c) {
        c = a + b;
        require(c >= a);
    }

    function sub(uint a, uint b) internal pure returns (uint c) {
        require(b <= a);
        c = a - b;
    }

    function mul(uint a, uint b) internal pure returns (uint c) {
        c = a * b;
        require(a == 0 || c / a == b);
    }

    function div(uint a, uint b) internal pure returns (uint c) {
        require(b > 0);
        c = a / b;
    }
}

contract Owned {
    address public owner;

    event OwnershipTransferred(address indexed _from, address indexed _to);

    constructor() public {
        owner = msg.sender;
    }

    modifier onlyOwner {
        require(msg.sender == owner, 'only owner can do this');
        _;
    }

    function transferOwnership(address _newOwner) public onlyOwner {
        owner = _newOwner;
        emit OwnershipTransferred(owner, _newOwner);
    }
}

contract TimeLock is Owned {
    using SafeMath for uint;

    uint8 private nextSubtract = 0;
    uint8 private nextScheduleId = 0;

    address[] public beneficiaries; //
    uint[] public scheduleList; //

    mapping(uint8 => uint) public schedules;
    mapping(address => mapping(address => uint)) public balances;
    mapping(address => uint) private percentages; //
    
    event NewVesting(address newVestingContract, uint indexed timeCreated);
    event Distributed(address token, address executor, uint round);
    event Withdrawn(address token, address beneficiary, uint amount);
    
    constructor(address[] memory _beneficiary, uint[] memory _percentages, uint[] memory _schedules) public {
        _addVesting(_beneficiary, _percentages, _schedules);
    }
    
    function _addVesting(address[] memory _beneficiary, uint[] memory _percentages, uint[] memory _schedules) internal {
        require(_beneficiary.length == _percentages.length, 'Beneficiary and percentage arrays must have the same length');
        uint totalPercentages;
        for(uint i = 0; i < _beneficiary.length; i++) {
            beneficiaries.push(_beneficiary[i]);
            percentages[_beneficiary[i]] = _percentages[i];
            totalPercentages = totalPercentages.add(_percentages[i]);
        }
        require(totalPercentages == 100, 'Percentages must sum up to 100');
        for(uint8 i = 0; i < _schedules.length; i++) {
            scheduleList.push(_schedules[i]);
            schedules[i] = now + _schedules[i];
        }
    }
    
    function percentageOf(address _beneficiary) external view returns(uint){
        return percentages[_beneficiary];
    }
    
    function _calculatePayment(address _beneficiary, address token, uint totalBalances) internal view returns(uint){
        uint balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, 'Empty pool');
        return (percentages[_beneficiary] * (balance - totalBalances)) / ((scheduleList.length - nextSubtract) * 100);
    }

    function distributePayment(address token) external {
        require(now >= schedules[nextScheduleId], 'Realease time not reached');
        uint totalBalances;
        for(uint i = 0; i < beneficiaries.length; i++) {
            totalBalances = totalBalances.add(balances[beneficiaries[i]][token]);
        } 
        for(uint i = 0; i < beneficiaries.length; i++){
            uint payment = _calculatePayment(beneficiaries[i], token, totalBalances);
            balances[beneficiaries[i]][token] = balances[beneficiaries[i]][token].add(payment);
        }
        nextScheduleId++; 
        nextSubtract++;
        emit Distributed(token, msg.sender, nextScheduleId);
    }
    
    function withdrawPayment(address token) external {
        require(balances[msg.sender][token] > 0, 'No balance to withdraw'); 
        IERC20(token).transfer(msg.sender, balances[msg.sender][token]);
        emit Withdrawn(token, msg.sender, balances[msg.sender][token]);
        balances[msg.sender][token] = 0;
    }
}

contract TimeLockFactory is TimeLock {

    address[] private vestings;

    constructor(address[] memory _beneficiary, uint[] memory _percentages, uint[] memory _schedules) 
        TimeLock(_beneficiary, _percentages, _schedules) public {
    }

    function newVesting(address[] calldata _beneficiary, uint[] calldata _percentages, uint[] calldata _schedules) external onlyOwner {
        address timeLockInstance = address(new TimeLock(_beneficiary, _percentages, _schedules));
        vestings.push(address(timeLockInstance));
        emit NewVesting(address(timeLockInstance), now);
    }

    function getVestings() external view returns (address[] memory) {
        return vestings;
    }
}
