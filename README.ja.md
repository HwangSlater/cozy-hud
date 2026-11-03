<div align="center">

# cozy-hud

### ターミナルの横に、小さな相棒を

Claude Code にピクセルキャラクターと小さなダッシュボードを付ける mod セット。<br>
Claude が作業すると一緒に動き、終わると跳ね、コンテキストが減ると汗をかきます。

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-mod-d97757.svg)](#はじめかた)
![Characters](https://img.shields.io/badge/characters-14-f2a0a0.svg)
[![Local only](https://img.shields.io/badge/data-stays%20local-555.svg)](#データは自分のパソコンだけに)

[한국어](README.md) · [English](README.en.md) · **日本語** · [简体中文](README.zh-CN.md)

<img src="docs/images/characters.png" alt="cozy-hud のキャラクター 14 種" width="760">

</div>

---

> 画面内の文言(設定・吹き出し・カード)は今のところ韓国語です。

## 待ち時間を、少しだけ楽しく

Claude に作業を任せると、画面には文字が積み重なるだけ。いま何をしているのか、どれだけ使ったのか、コンテキストがどれだけ残っているのか、ひと目では分かりにくいものです。

**cozy-hud** は、横のパネルと入力欄の上の一行に、小さなキャラクターとダッシュボードを置きます。

- Claude の作業中は足を動かし、タスクが終わると跳ね、コンテキストが 80% を超えると汗をかき、しばらく休むと眠ります。
- ツールを使うたびに、何をしているかを吹き出しで知らせます。「register.tsx を読み込み中」のように。
- トークン、コンテキスト、ToDo などのカードは必要なものだけ入れられます。どの組み合わせでも同じデザインで表示されます。

<div align="center">
<img src="docs/images/hud.png" alt="実際に使っている HUD パネル:キャラクター、吹き出し、ToDo・コンテキスト・トークンのカード" width="360">
<img src="docs/images/hud-bun.png" alt="肉まんを小サイズにした HUD パネル" width="360">
</div>

## はじめかた

Claude Code で一度だけインストールします。

```
/plugin marketplace add HwangSlater/cozy-hud
/plugin install cozy-hud@cozy-hud
```

カードは好きなものだけ追加します。

```
/plugin install cozy-hud-tokens@cozy-hud
/plugin install cozy-hud-context@cozy-hud
/plugin install cozy-hud-checklist@cozy-hud
```

「HUD」と「HUD 設定」の 2 つのタブが開きます。これで完了です。

## 入っているもの

| mod | 役割 |
| --- | --- |
| `cozy-hud` | コア(必須)。パネルと入力欄の上の一行、設定、キャラクター 14 種 |
| `cozy-hud-tokens` | 今回の返答とセッション全体のトークン量、返答ごとの棒グラフ |
| `cozy-hud-context` | コンテキスト使用率のゲージ。警告の開始 % を選べます |
| `cozy-hud-checklist` | Claude の ToDo リストをリアルタイムで。Markdown のチェックリストファイルも指定できます |

キャラクター:クロード、ネコ、ペンギン、ヒヨコ、ウサギ、キツネ、ホッキョクギツネ、子犬、カエル、クマ、パンダ、ハムスター、いちご大福、肉まん。

## 変更する

「HUD 設定」タブでマウスかキーボードで変更します。変更はすぐ下のプレビューに反映され、セッションが変わっても残ります。

| タブ | 選べるもの |
| --- | --- |
| キャラクター | パネル・入力欄の上のサイズ(大・中・小)、動きの速さ、眠るまでの時間 |
| 配置・吹き出し | 表示する場所、ツール使用時の吹き出し、完了・警告への反応 |
| テーマ | 自動・基本・アンバー・ミント・モノクロ |
| カード | 表示・非表示、順番、カードごとの設定 |

キャラクターはプレビュー下の `[ < ]` `[ > ]` で切り替えるか、名前を押して一覧から選びます。

キーボード:`Ctrl+X` のあと `Tab` で設定タブに入り、`Tab` 次の項目・`Enter` 選択・`1`〜`4` タブ・`A`/`D` キャラクター切り替え・`Esc` 抜ける。

すぐ変えるコマンドもあります。

```
/hud                    設定タブを開く
/hud character cat      キャラクターを変える
/hud theme mint         テーマを変える
/hud layout pane        パネルだけに表示
/hud reset              初期設定に戻す
```

## データは自分のパソコンだけに

cozy-hud はネットワークを使いません。Claude Code がすでに持っている情報(トークン量、コンテキスト、ツール名、ToDo)を描くだけです。設定は Claude Code の mod ストレージにだけ残ります。

## キャラクター・カードを作る

ほかの mod は `dependencies: ["cozy-hud"]` でコアに頼れます。

- キャラクター:ピクセル文字の絵と色表を `$.hud.characters({ list })` に渡します。形式は [core/data/characters.json](core/data/characters.json) を参照。1 文字が 1 ピクセル、`.` は透明、`~` は汗のしずく用なので色の文字には使いません。
- カード:`$.hud.put({ id, title, lines, brief })` で送ります。色は直接選ばず `dim`・`ok`・`warn` のような役割を書きます。型は [core/types/index.d.ts](core/types/index.d.ts) にあります。
- コアは再読み込み時に `hud.ready` を送るので、`session.start` と `hud.ready` の両方で送ってください。

## ライセンス

[MIT](LICENSE) © [HwangSlater](https://github.com/HwangSlater)。クロードのキャラクターは Anthropic のマスコットのファンアートです。
