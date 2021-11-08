import Web3 from 'web3'
import { newKitFromWeb3 } from '@celo/contractkit'
import BigNumber from "bignumber.js"
import erc20Abi from "../contract/erc20.abi.json"
import toolrentalabi from "../contract/toolrental.abi.json"

const ERC20_DECIMALS = 18
const cUSDContractAddress = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1"
// const trContractAddress = '0x679e5c2979D549373a5Ba3b7F5E37C54Bb5ed841';
// const trContractAddress = '0xCEc28Bd240F8B6D49F7fb7743153B34bc044b1f1';
const trContractAddress =     '0x689b867D3b13a26542cFbEfE0c14E8ad1AC3E96A';


let kit
let contract
let tools = []
let fees;

const connectCeloWallet = async function () {
  if (window.celo) {
    try {
      notification("⚠️ Please approve this DApp to use it.")
      await window.celo.enable()
      notificationOff()
      const web3 = new Web3(window.celo)
      kit = newKitFromWeb3(web3)

      const accounts = await kit.web3.eth.getAccounts()
      kit.defaultAccount = accounts[0]

      contract = new kit.web3.eth.Contract(toolrentalabi, trContractAddress)
    } catch (error) {
      notification(`⚠️ ${error}.`)
    }
  } else {
    notification("⚠️ Please install the CeloExtensionWallet.")
  }
}

async function approve(_price) {
  const cUSDContract = new kit.web3.eth.Contract(erc20Abi, cUSDContractAddress)

  const result = await cUSDContract.methods
    .approve(trContractAddress, _price)
    .send({ from: kit.defaultAccount })
  return result
}

const getBalance = async function () {
  const totalBalance = await kit.getTotalBalance(kit.defaultAccount)
  const cUSDBalance = totalBalance.cUSD.shiftedBy(-ERC20_DECIMALS).toFixed(2)
  document.querySelector("#balance").textContent = cUSDBalance
}


document.querySelector("#debug-btn").addEventListener('click', async (e) => {
  const res = await contract.methods.getToolsLength().call();
})

document
  .querySelector("#newProductBtn")
  .addEventListener("click", async (e) => {
    const params = [
      document.getElementById("newToolName").value,
      document.getElementById("newImgUrl").value,
      new BigNumber(document.getElementById("newPrice").value)
      .shiftedBy(ERC20_DECIMALS)
      .toString()
    ]
    notification(`⌛ Adding "${params[0]}"...`)
    try {
        const result = await contract.methods
          .addTool(...params)
          .send({ from: kit.defaultAccount })
        console.log('add tool result',result);
      } catch (error) {
        notification(`⚠️ ${error}.`)
      }
      notification(`🎉 You successfully added "${params[0]}".`)
      getTools()
  })
 
document.querySelector("#marketplace").addEventListener("click", async (e) => {
  if (e.target.className.includes("checkoutBtn")) {
    const index = e.target.id
    notification("⌛ Waiting for payment approval...")
    try {
      await approve(tools[index].price)
    } catch (error) {
      notification(`⚠️ ${error}.`)
    }
    notification(`⌛ Awaiting payment for "${tools[index].name}"...`)
    const duration = rentalDuration();
    try {
      
      const result = await contract.methods
        .checkoutTool(index)
        .send({ from: kit.defaultAccount });
      console.log('checkout result',result);
      notification(`🎉 You successfully bought "${tools[index].name}".`)
      getTools()
      getBalance()
    } catch (error) {
        console.log(error)
        notification(`⚠️ ${error.message}. Check console for more detailsd`)
    }
  }
})

 
document.querySelector("#marketplace").addEventListener("click", async (e) => {
  if (e.target.className.includes("returnBtn")) {
    const date = new Date();
    const index = e.target.id
    notification(`⌛ Awaiting payment for "${tools[index].name}"...`)
    try {
      fees = await contract.methods.calculateFees(index, date.getTime()).call();
      const result = await contract.methods
        .returnTool(index, date.getTime())
        .send({ from: kit.defaultAccount });
      console.log(result);
      notification(`🎉 You successfully returned "${tools[index].name}".`)
      getTools()
      getBalance()
    } catch (error) {
        notification(`⚠️ ${error}.`)
    }
  }
})


document.querySelector("#marketplace").addEventListener("click", async (e) => {
  if (e.target.className.includes("lateFeeBtn")) {
    const index = e.target.id
    notification("⌛ Waiting for payment approval...")
    try {
      await approve(tools[index].price)
    } catch (error) {
      notification(`⚠️ ${error}.`)
    }
    notification(`⌛ Awaiting payment for "${tools[index].name}"...`)
    const date = new Date();
    try {
      
      const result = await contract.methods
        .payFees(index, date.getTime())
        .send({ from: kit.defaultAccount });
      console.log(result);
      notification(`🎉 You successfully paid fees for "${tools[index].name}".`)
      getTools()
      getBalance()
    } catch (error) {
        console.log(error)
        notification(`⚠️ ${error.message}.`)
    }
  }
})

const getTools = async function() {
  const _toolsLength = await contract.methods.getToolsLength().call()
  const _tools = []
  for (let i = 0; i < _toolsLength; i++) {
      let _tool = new Promise(async (resolve, reject) => {
        let p = await contract.methods.tools(i).call()
        resolve({
          index: i,
          owner: p[0],
          name: p[1],
          image: p[2],
          price: new BigNumber(p[3]),
          duration: p[4],
          feePaid: p[5],
          available: p[6]
        })
      })
      _tools.push(_tool)
  }
    tools = await Promise.all(_tools)
    renderTools()
}

function renderTools() {
  document.getElementById("marketplace").innerHTML = "";
  tools.forEach((_tool) => {
    const newDiv = document.createElement("div")
    newDiv.className = "col-md-4"
    if (_tool.available) 
    {
      newDiv.innerHTML = checkoutTemplate(_tool);
    } else {
      const date = new Date();
      if (date.getTime() > _tool.duration & !_tool.feePaid) 
      {
        newDiv.innerHTML = lateFeeTemplate(_tool, fees);
      } else {
        newDiv.innerHTML = returnTemplate(_tool)
      }
    }
    document.getElementById("marketplace").appendChild(newDiv)
  })
}

function notification(_text) {
  document.querySelector(".alert").style.display = "block"
  document.querySelector("#notification").textContent = _text
}

function notificationOff() {
  document.querySelector(".alert").style.display = "none"
}

function checkoutTemplate(_product) {
  return `
    <div class="card mb-4">
      <img class="card-img-top" src="${_product.image}" alt="...">
      <div class="card-body text-left p-4 position-relative">
        <div class="translate-middle-y position-absolute top-0">
        ${identiconTemplate(_product.owner)}
        </div>
        <h2 class="card-title fs-4 fw-bold mt-2">${_product.name}</h2>
        <p class="card-text mb-4" style="min-height: 82px">
          Return by ${returnDate(rentalDuration())}             
        </p>
        
        <div class="d-grid gap-2">
          <a class="btn btn-lg btn-outline-dark bg-success checkoutBtn-${_product.name} fs-6 p-3" id=${
            _product.index
          }>
            Checkout for ${_product.price.shiftedBy(-ERC20_DECIMALS).toFixed(6)} cUSD
          </a>
        </div>
      </div>
    </div>
  `
}

function returnTemplate(_product) {
  return `
    <div class="card mb-4">
      <img class="card-img-top" src="${_product.image}" alt="...">
      <div class="card-body text-left p-4 position-relative">
        <div class="translate-middle-y position-absolute top-0">
        ${identiconTemplate(_product.owner)}
        </div>
        <h2 class="card-title fs-4 fw-bold mt-2">${_product.name}</h2>
        <p class="card-text mb-4" style="min-height: 82px">
          Return by ${returnDate(rentalDuration())}             
        </p>
        
        <div class="d-grid gap-2">
          <a class="btn btn-lg btn-outline-dark returnBtn bg-primary fs-6 p-3" id=${
            _product.index
          }>
            Return 
          </a>
        </div>
      </div>
    </div>
  `
}

function lateFeeTemplate(_product, _fee) {
  // fees = calculateFees(_tool.index, date.getTime());
  console.log(_fee);
  return `
    <div class="card mb-4">
      <img class="card-img-top" src="${_product.image}" alt="...">
      <div class="card-body text-left p-4 position-relative">
        <div class="translate-middle-y position-absolute top-0">
        ${identiconTemplate(_product.owner)}
        </div>
        <h2 class="card-title fs-4 fw-bold mt-2">${_product.name}</h2>
        <p class="card-text mb-4" style="min-height: 82px">
          Return by ${returnDate(rentalDuration())}             
        </p>
        
        <div class="d-grid gap-2">
          <a class="btn btn-lg btn-outline-dark bg-warning lateFeeBtn fs-6 p-3" id=${
            _product.index
          }>
            Fees accrued
          </a>
        </div>
      </div>
    </div>
  `
}

function identiconTemplate(_address) {
  const icon = blockies
    .create({
      seed: _address,
      size: 8,
      scale: 16,
    })
    .toDataURL()

  return `
  <div class="rounded-circle overflow-hidden d-inline-block border border-white border-2 shadow-sm m-0">
    <a href="https://alfajores-blockscout.celo-testnet.org/address/${_address}/transactions"
        target="_blank">
        <img src="${icon}" width="48" alt="${_address}">
    </a>
  </div>
  `
}

window.addEventListener('load', async () => {
  notification("⌛ Loading...")
  await connectCeloWallet()
  await getBalance()
  await getTools()
  notificationOff()
});

function rentalDuration() {
  const duration = 1.2096 * 10e8; // 14 days
  const today = new Date();
  return today.getTime() + duration;
}

function returnDate(_time) {
  const rb = new Date();
  rb.setTime(_time);
  return `${rb.getUTCMonth()+1}/${rb.getDate()}/${rb.getUTCFullYear()}`; 
}
