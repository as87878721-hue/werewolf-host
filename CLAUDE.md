@AGENTS.md

# 專案說明

狼人殺主持輔助 App — 協助主持人引導夜晚流程

## 專案環境

- **語言 / 框架**：TypeScript + React Native (Expo SDK 56, blank template)
- **主要套件**：
  - `zustand` — 全域狀態管理（遊戲狀態）
  - `@react-navigation/native` + `@react-navigation/native-stack` — 畫面導航
  - `react-native-screens` + `react-native-safe-area-context` — Navigation 依賴
- **Node 版本**：24.x
- **Python 版本**：不適用（純 Node.js 專案）

## 目錄結構

```
src/
  data/roles.ts       腳色定義資料庫（10 種腳色）
  store/gameStore.ts  Zustand store，含夜晚結算邏輯
  theme/colors.ts     深色主題色票
  screens/
    HomeScreen.tsx    首頁
    SetupScreen.tsx   腳色選擇（+/- 按鈕）
    OrderScreen.tsx   夜晚順序調整（▲▼ 按鈕）
    NightScreen.tsx   夜晚逐步執行（核心）
    ResultScreen.tsx  夜晚結果公布
App.tsx               React Navigation Stack 根設定
```

## 開發與測試

```bash
# 啟動開發伺服器（手機安裝 Expo Go App 掃 QR Code）
npx expo start

# Web 預覽
npx expo start --web
```

## 多視窗並行工作流程（選用）

使用 git worktree 讓多個 Claude Code 視窗同時工作：

| 資料夾 | Branch | 負責範圍 |
|--------|--------|----------|
| `werewolf-host` | master | 穩定版本，不直接修改 |
| `werewolf-host-feature` | feature | 加新功能 |
| `werewolf-host-bugfix` | bugfix | 修 bug |

每個視窗開啟時自動執行：
1. 確認目前所在 branch（`git branch --show-current`）
2. 依照上表判斷自己的職責範圍，不跨界修改
3. 完成後 commit 到自己的 branch，不 merge 到 master

## 測試與回報鐵則（不可違反）

1. 當我說程式有錯，預設「我是對的、錯的是程式」。不准臆測、不准暗示、不准提出我操作錯誤作為第一反應。先從你自己寫的程式找問題。

2. 在說出「沒問題」「修好了」「應該可以了」「測試通過」這類結論之前，必須實際執行測試。沒跑過就不准下結論。

3. 任何測試結論都必須附上「實際執行的指令」＋「完整的原始輸出」。只給結論、不貼輸出 ＝ 無效回報，等於沒做。

4. 禁止使用「應該」「理論上」「按理說」「大概沒問題」這類沒有實測支撐的措辭。要嘛你跑過、貼結果；要嘛你老實說「我還沒測」。

5. 如果問題重現了而我提供的資訊不足，你要主動問我要 log、要輸出、要重現步驟，而不是猜是我的錯。

6. 找問題的順序固定為：先查你的程式碼 → 再查測試本身 → 最後才考慮環境。把使用者操作當成最後、且需要證據才能提出的可能性。
