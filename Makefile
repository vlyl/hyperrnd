.PHONY: help install fork deploy deploy-mainnet test frontend clean

# Default account for local testing (Anvil account #0)
PRIVATE_KEY ?= 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ANVIL_PID_FILE := .anvil.pid

help: ## Show this help
	@echo ""
	@echo "HyperEVM RNG Demo - 命令列表"
	@echo "================================"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

install: ## 安装所有依赖
	@echo ">>> 安装 Foundry 依赖..."
	cd contracts && forge install foundry-rs/forge-std --no-git 2>/dev/null || true
	@echo ">>> 安装前端依赖..."
	cd frontend && bun install
	@echo ">>> 安装完成 ✅"

fork: ## 启动 Anvil 并 Fork HyperEVM 主网（Chain ID 999 → 本地 31337）
	@echo ">>> 启动 Anvil fork of HyperEVM mainnet..."
	@echo ">>> RPC: http://127.0.0.1:8545"
	@echo ">>> 使用 Ctrl+C 停止"
	@echo ""
	anvil \
		--fork-url https://rpc.hyperliquid.xyz/evm \
		--chain-id 31337 \
		--port 8545 \
		--accounts 10 \
		--balance 10000 \
		--mnemonic "test test test test test test test test test test test junk"

fork-testnet: ## 启动 Anvil fork of HyperEVM 测试网
	@echo ">>> 启动 Anvil fork of HyperEVM testnet..."
	anvil \
		--fork-url https://rpc.hyperliquid-testnet.xyz/evm \
		--chain-id 31337 \
		--port 8545 \
		--block-time 1 \
		--accounts 10 \
		--balance 10000

build: ## 编译合约
	@echo ">>> 编译合约..."
	cd contracts && forge build
	@echo ">>> 编译完成 ✅"

test: ## 运行所有合约测试
	@echo ">>> 运行测试..."
	cd contracts && forge test -v
	@echo ">>> 测试完成 ✅"

test-verbose: ## 运行测试（详细输出）
	cd contracts && forge test -vvv

deploy: ## 部署所有合约到本地 Anvil（需要先运行 make fork）
	@echo ">>> 部署合约到本地 fork..."
	@echo ">>> 确保 Anvil 正在运行（make fork）"
	mkdir -p frontend/src/contracts
	cd contracts && forge script script/Deploy.s.sol:DeployLocal \
		--rpc-url http://127.0.0.1:8545 \
		--private-key $(PRIVATE_KEY) \
		--broadcast \
		-v
	@echo ">>> 部署完成 ✅"
	@echo ">>> 地址已写入 frontend/src/contracts/deployments.local.json"

deploy-mainnet: ## 部署到 HyperEVM 主网（危险！需要设置 PRIVATE_KEY）
	@echo ">>> ⚠️  部署到 HyperEVM 主网"
	@test -n "$(PRIVATE_KEY)" || (echo "错误: 请设置 PRIVATE_KEY 环境变量" && exit 1)
	cd contracts && forge script script/Deploy.s.sol:DeployMainnet \
		--rpc-url https://rpc.hyperliquid.xyz/evm \
		--private-key $(PRIVATE_KEY) \
		--broadcast \
		-v

frontend: ## 启动前端开发服务器
	@echo ">>> 启动前端..."
	@echo ">>> 打开 http://localhost:5173"
	cd frontend && bun run dev

frontend-build: ## 构建前端生产版本
	cd frontend && bun run build

clean: ## 清理构建产物
	cd contracts && forge clean
	cd frontend && rm -rf dist node_modules/.vite

# Helper: show deployed contract addresses
show-addresses: ## 显示已部署的合约地址
	@cat frontend/src/contracts/deployments.local.json 2>/dev/null || echo "尚未部署，运行 make deploy"

# Helper: get current block info from local fork
block-info: ## 显示当前区块信息（本地 fork）
	@cast block latest --rpc-url http://127.0.0.1:8545 2>/dev/null || echo "Anvil 未运行"

# Helper: check prevrandao value (demonstrates why it's weak on HyperEVM)
check-prevrandao: ## 查看当前 block.prevrandao 值
	@echo ">>> block.prevrandao (difficulty) on local fork:"
	@cast block latest difficulty --rpc-url http://127.0.0.1:8545 2>/dev/null || echo "Anvil 未运行"
	@echo ""
	@echo ">>> 注意：HyperEVM (~21 validators) 的 prevrandao 不如 Ethereum 主网安全"

# Setup: Import Anvil account to MetaMask
import-key: ## 显示 Anvil 测试私钥（用于 MetaMask 导入）
	@echo ">>> Anvil 测试账户私钥（#0）："
	@echo "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
	@echo ""
	@echo ">>> 地址: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
	@echo ">>> 余额: 10000 HYPE（Anvil 测试账户）"
	@echo ""
	@echo ">>> 在 MetaMask 中："
	@echo "  1. 点击账户头像 → 导入账户"
	@echo "  2. 粘贴上方私钥"
	@echo "  3. 添加网络: http://127.0.0.1:8545 (Chain ID: 31337)"
