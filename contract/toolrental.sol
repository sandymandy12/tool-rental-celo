// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.9.0;

interface IERC20Token {
  function transfer(address, uint256) external returns (bool);
  function approve(address, uint256) external returns (bool);
  function transferFrom(address, address, uint256) external returns (bool);
  function totalSupply() external view returns (uint256);
  function balanceOf(address) external view returns (uint256);
  function allowance(address, address) external view returns (uint256);

  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);
}

contract ToolRental {

    
    uint internal toolsLength = 0;
    address internal cUsdTokenAddress = 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1;
    address internal manager = 0xf8ACd6ae80453CC68CFe5a81781867D5b8F299b9;
    mapping(address => bool) employees;
    
    modifier onlyEmployees() {
        require(employees[msg.sender], "Must be employee");
            _;
    }
    
    constructor() {
        employees[manager] = true;
    }
    
    
    struct Tool {
        address payable owner;
        string name;
        string image;
        uint price;
        uint duration; // time in millis
        bool feePaid;
        bool available;
    }


    mapping (uint => Tool) internal tools;

    function addTool(
        string memory _name,
        string memory _image,
        uint _price
    ) public onlyEmployees {
        
        tools[toolsLength] = Tool(
            payable(msg.sender),
            _name,
            _image,
            _price,
            0,
            false,
            true
        );
        toolsLength++;
    }

    function readTool(uint _index) public view returns (
        address payable,
        string memory, 
        string memory, 
        uint, 
        uint, 
        bool,
        bool
    ) {
        return (
            tools[_index].owner,
            tools[_index].name, 
            tools[_index].image, 
            tools[_index].price, 
            tools[_index].duration,
            tools[_index].feePaid,
            tools[_index].available
        );
    }
    
    function checkoutTool(uint _index) public payable  {
        require(tools[_index].available, "Tool not available");
        require(
          IERC20Token(cUsdTokenAddress).transferFrom(
            msg.sender,
            tools[_index].owner,
            tools[_index].price
          ),
          "Checkout failed."
        );
        tools[_index].available = false;
        tools[_index].duration = (block.timestamp) + 14 days;
        tools[_index].feePaid = false;
        
    }
    
    function returnTool(uint _index) public {
        
        require(tools[_index].available == false, "Tool is available");
        
        if(calculateFees(_index) > 0) { // returns 0 unless past deadline
            require(tools[_index].feePaid = true, "Fee not paid");
        }
        
        tools[_index].available = true;
        tools[_index].duration = block.timestamp;
        delete tools[_index].feePaid;
        
    }
    
    function calculateFees(uint _index) public view returns(uint) {
        
        if(block.timestamp > tools[_index].duration) {
            // planning to add extended daily fees based on date. 
            return(tools[_index].price / 10); // 10% is the idea but could use suggestions for a proper way
        }
        return(0);
    }
    
    function payFees(uint _index) public payable {
        uint fee = calculateFees(_index);
        //require(calculateFees(_index, _date) > 0, "No fee accrued!");
        if (fee > 0) {
            require(
          IERC20Token(cUsdTokenAddress).transferFrom(
            msg.sender,
            manager,
            fee
          ),
          "Fee payment failed."
        );
        tools[_index].feePaid = true; // seems risky to do this at the end this way if there is a bug/error
        }
        
    }
    
    function getToolsLength() public view returns (uint) {
        return (toolsLength);
    }
    
    function setEmployees(address _empl, bool _state) public onlyEmployees {
        employees[_empl] = _state;
    }
}