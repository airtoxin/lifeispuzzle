# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Z3 SATソルバーを使用した数独ソルバーの実装プロジェクト。Node.jsで実装されている。

## 技術スタック

- **Node.js**: JavaScriptランタイム
- **z3-solver**: Z3 SATソルバーのNode.jsバインディング（v4.15.3）

## 開発環境

### 必要な環境

- Node.js (推奨バージョン: 18以上)
- npm

### セットアップ

```bash
npm install
```

## アーキテクチャ

Z3 SATソルバーを使用して数独の制約を論理式として表現し、充足可能性問題として解く。

数独の制約：

1. 各セルには1-9の数字が入る
2. 各行には1-9の数字が一度ずつ現れる
3. 各列には1-9の数字が一度ずつ現れる
4. 各3x3のブロックには1-9の数字が一度ずつ現れる

## よく使用するコマンド

### 実行

```bash
node index.js
```

### テスト

```bash
npm test
```

### パッケージの追加

```bash
npm install <package-name>
```
