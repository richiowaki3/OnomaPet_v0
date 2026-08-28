# OnomaPet Kinematic Simulator v0.9 (オノマトペ運動力学シミュレーター)

オノマトペ（擬音語・擬態語）の音象徴プロファイルから、音源・調音・音響ベクトルおよび 10チャンネル運動力学ボリューム行列モデルを生成し、**5ノード 3D 弾性メッシュ（CH-1 昆虫飛翔 ＋ 4ノード面構成）** と **リアルタイム 2D 地震計 (Seismograph)** で可視化・音響シミュレーションする Web アプリケーションです。

🌐 **Live Public Demo**: [https://richiowaki3.github.io/OnomaPet_v0/](https://richiowaki3.github.io/OnomaPet_v0/)

---

## 🌟 主な特徴 (Key Features)

### 1. 🐝 5ノード 3D 昆虫飛翔・面構成メッシュモデル (5-Node 3D Elastic Mesh)
- **N0 (CH-1 飛翔コアノード)**: 蝶 🦋（優雅8の字旋回）、蜂 🐝（高周波ホバリング）、ハエ 🪰（急転換ジッター）のように 3D 空間内を自由自在に飛翔・浮遊。
- **N1, N2, N3, N4 (四頂点・面構成ノード)**: N0 の周りを囲んで枠線とスポークを結び、立体的な面（Quad Mesh Surface）を形成。N0 を高さ 0 基準として相殺のない運動変調。
- **俯瞰幾何モーフィング (Top-Down Morphing)**: 上から見た視点において、正方形 ▫ ↔ ダイヤモンド ◊ ↔ 長方形 ▭ ↔ 平行四辺形 ▱ へリアルタイムに変形。
- **画面内クランプ (Spatial Bounding Constraint)**: 球面・Y軸バウンダリ制限により画面枠線内へ安全に運動を補正。

### 2. 📊 5チャンネル 2D リアルタイム地震計 (Seismograph Analyzer)
- **CH-1 (変位 / Displacement)**: 垂直位置・高度波形
- **CH-2 (モータ力 / Driving Force)**: 発声アタック・推進エンベロープ
- **CH-3 (乱流 / Turbulence)**: レイノルズ数（Re）流体乱流ノイズ
- **CH-4 (運動特性 / Laban Effort)**: Weight(重さ), Time(時間), Space(空間), Flow(流動) の 4色垂直トラック動点
- **CH-5 (拍節包絡線 / Beat Pulse)**: BPM・テンポ脈動パルス

### 3. 🎛️ 10チャンネル運動力学ボリューム行列モデル (10-Channel Kinematic Volume Matrix)
言葉の印象・音素から 10個の独立運動関数 $F_1 \sim F_{10}$ への押し出し量 ($\text{VOL}_1 \sim \text{VOL}_{10} \in [0, 255]$) を自動計算：
1. 瞬発衝撃バースト
2. 旋回うねり波
3. 重厚たわみ沈み込み
4. 粒状コロコロ転がり
5. 呼吸・脈動プレッシャー
6. 粘性スライム (Viscous Slime)
7. 振り子スイング
8. 水滴散乱
9. 粒子高周波ジッター
10. 一方通行直線スライド

---

## 🚀 公開・ローカル実行方法 (Usage)

### 1. GitHub Pages でオンライン閲覧
リポジトリの Settings ⚙️ -> Pages から `main` ブランチを有効化することで、全ブラウザ・PC・スマートフォンから以下の URL で即座に閲覧可能です：
👉 **https://richiowaki3.github.io/OnomaPet_v0/**

### 2. ローカル環境での起動
```bash
git clone https://github.com/richiowaki3/OnomaPet_v0.git
cd OnomaPet_v0
python -m http.server 8000
```
ブラウザで `http://localhost:8000/index.html` を開いてご使用ください。

---

## 📄 ライセンス (License)
MIT License
