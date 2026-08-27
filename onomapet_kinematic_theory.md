# OnomaPet Kinematic Theory & Demo Application Manual
**音響・調音物理と10チャンネル運動力学ボリューム行列モデル仕様書**

---

## 1. 概要 (Overview)

本システム **OnomaPet** は、日本語オノマトペ（感性・音象徴表現）が持つ物理的運動像および音響調音メカニズムを、**音源・フィルタ理論（Source-Filter Theory）** と **ラバン・エフォート理論（Laban Effort Theory）** に基づいて高解像度で数式化・可視化する統合物理・音声解析デモアプリケーションです。

---

## 2. 5チャンネル地震計スクロールチャート構造 (5-Channel Seismograph Renderer)

オノマトペの物理運動は、リアルタイム帯状記録紙（Strip-Chart Seismograph）上の5チャンネルに分解展開されます：

| チャンネル名 | 物理・音響的意味 | 運動表現メカニズム |
| :--- | :--- | :--- |
| **CH-1 [NODE Y DISPLACEMENT]** | **統合物体変位 (Unified Hull Displacement)** | 4ノード全体の幾何学的たわみ・重心変位。ノード間の位相遅延ラグにより時間差波動を表現。 |
| **CH-2 [DRIVING MOTOR FORCE]** | **駆動モータ力 (Piston Driving Motor)** | オノマトペの基本拍節・モーラアクセントに応じてノード群を垂直（Y軸）方向に打ち上げるピストン動力。 |
| **CH-3 [REYNOLDS TURBULENCE]** | **レイノルズ乱流 (Reynolds Turbulence)** | 気流の摩擦・非周期乱れ（無声音・摩擦音）から生成される高周波表面ジッター微振動。 |
| **CH-4 [DYNAMIC EFFORT FORCES]**| **ラバン・エフォート力学 (Laban Effort Matrix)** | 重さ(Weight/赤), 時間(Time/黄), 空間(Space/緑), 流動(Flow/シアン)の4動的ライン。 |
| **CH-5 [AUDIO BEAT ENVELOPE]** | **発声ビート包絡線 (Audio Beat Envelope)** | Web Audio Synthesizer の音響発声インパルスと直結するビートエンベロープ。 |

---

## 3. 10チャンネル運動力学ボリューム行列モデル (10-Channel Kinematic Volume Matrix: 0〜255)

オノマトペの語感・意味・音素プロファイルから、**10個の独立した運動関数 $F_1(t) \dots F_{10}(t)$ に対する押し出しゲイン $\text{VOL}_k \in [0, 255]$** が自動算出されます：

$$\text{Gain}_k = \frac{\text{VOL}_k}{255} \quad (k = 1, 2, \dots, 10)$$

### 運動関数 $F_k(t)$ とボリューム算出数式一覧 (`OnomaPetKinematics.js`)

1. **$F_1(t)$ 瞬発衝撃バースト (Transient Shock Burst)**
   $$\text{VOL}_1 = \text{Clamp}_{0}^{255} \left( (\text{Plosive} ? 180 : 20) + 8 \times \text{Time} + (\text{Sokuon} ? 50 : 0) \right)$$
   *軌道*: $r(t) = \sin(3.5t) e^{-0.7t} \cdot 35 \cdot \text{Gain}_1$ （中心からパッと飛び散る衝撃）

2. **$F_2(t)$ 旋回うねり波 (Swirling Orbital Wave)**
   $$\text{VOL}_2 = \text{Clamp}_{0}^{255} \left( (9 - \text{Space}) \times 22 + (9 - \text{Flow}) \times 8 \right)$$
   *軌道*: $x(t) = 36 \sin(2t) \cdot \text{Gain}_2, \quad y(t) = 22 \sin(4t) \cdot \text{Gain}_2$ （8の字旋回）

3. **$F_3(t)$ 重厚たわみ沈み込み (Heavy Gravitational Sag)**
   $$\text{VOL}_3 = \text{Clamp}_{0}^{255} \left( \text{Weight} \times 25 + (\text{Plosive} ? 30 : 0) \right)$$
   *軌道*: $y(t) = y_0 + (12 + 26 |\sin(2.2t)|) \cdot \text{Gain}_3$ （地面へドスンと打ち付ける）

4. **$F_4(t)$ 粒状コロコロ転がり (Rolling Particle Swarm)**
   $$\text{VOL}_4 = \text{Clamp}_{0}^{255} \left( (\text{Reduplicated} ? 160 : 30) + (9 - \text{Weight}) \times 10 \right)$$
   *軌道*: 2粒子が回転半径 $18 \cdot \text{Gain}_4$ で歯車運動

5. **$F_5(t)$ 呼吸・脈動プレッシャー (Pulsating Pressure)**
   $$\text{VOL}_5 = \text{Clamp}_{0}^{255} \left( (9 - \text{Hardness}) \times 20 + \text{Flow} \times 8 \right)$$
   *軌道*: 脈動半径 $R(t) = 8 + 26 |\sin(2.5t)| \cdot \text{Gain}_5$ （風船状の伸縮）

6. **$F_6(t)$ 粘性糸引きスライム (Slime Stretch & Tear)**
   $$\text{VOL}_6 = \text{Clamp}_{0}^{255} \left( (\text{Nasal} ? 160 : 10) + \text{Flow} \times 12 + (9 - \text{Hardness}) \times 8 \right)$$
   *軌道*: べき乗伸長 $y(t) = y_0 + (\text{Phase})^{2.2} \times 55 \cdot \text{Gain}_6$ （糸を引いて切れる）

7. **$F_7(t)$ 振り子ゆらぎスイング (Pendulum Swing)**
   $$\text{VOL}_7 = \text{Clamp}_{0}^{255} \left( (\text{LongVowel} ? 150 : 20) + (9 - \text{Time}) \times 15 \right)$$
   *軌道*: 振幅角 $\theta(t) = 0.8 \sin(1.8t) \cdot \text{Gain}_7$ （ゆったり時計振り子）

8. **$F_8(t)$ 水滴・パラパラ散乱 (Rattling Drops)**
   $$\text{VOL}_8 = \text{Clamp}_{0}^{255} \left( (\text{RaLine} ? 180 : 20) + (\text{Sokuon} ? 50 : 0) \right)$$
   *軌道*: 3粒子のパラパラ自由落下・跳ね返り

9. **$F_9(t)$ 粒子高周波ジッター (Fine Particle Spray)**
   $$\text{VOL}_9 = \text{Clamp}_{0}^{255} \left( (\text{Fricative} ? 200 : 20) + \text{Reynolds} \times 10 \right)$$
   *軌道*: 8粒子の高周波カオススプレー散乱

10. **$F_{10}(t)$ 一方通行直線スライド (Linear Skate Slide)**
    $$\text{VOL}_{10} = \text{Clamp}_{0}^{255} \left( (\text{LongVowel} ? 180 : 30) + \text{Space} \times 10 \right)$$
    *軌道*: 水平直線軌道 $x(t) = x_0 + 42 \sin(1.2t) \cdot \text{Gain}_{10}$ （氷上直線滑走）

---

## 4. 人間感覚テンポ (BPM) & 音声拍節法則 (Phonetic Speech Rhythm Rules)

### ① 人間感性テンポスケール (Center ~65 BPM, Range 40..135)
日本語発声の自然な歩調に合わせて中心テンポを **65 BPM (1秒1拍)** に校正：
- 「のんびり」「ゆらーり」: **45 〜 55 BPM** （ゆったりした間隔）
- 「どしんどしん」「ころころ」: **52 〜 76 BPM** （標準的な歩調）
- 「せかせか」「あたふた」: **100 〜 105 BPM** （高速感）

### ② 語構造テンポ・音素持続ルール
- **連続反復音（畳語 / 例: かさかさ）**: 標準速度（速度比 $1.0\times$）。
- **単発音（1サイクル / 例: かさ）**: 半分の速度（速度比 $0.5\times$ / 1モーラの時間が2倍に伸長）。
- **長音伸長（例: かさー）**: 半分の速度（$0.5\times$） ＋ 「ー」の減衰音響（Decay/Release）が伸びる。
- **促音アタック（例: さかっ）**: 半分の速度（$0.5\times$） ＋ 音が前半に凝縮され、後半に完全無音ギャップ。

---

## 5. デモアプリケーション構成 (File System Architecture)

```
c:\Users\richi\.antigravity\onomapet00\
├── index.html                  # 統合WebUI（地震計キャンバス & 10種動点ギャラリー）
├── app.js                      # UIイベント制御 & アニメーションループマネージャー
├── onomatopoeia_dictionary.js  # 764語オノマトペ拡張辞書データベース
├── onomapet_kinematic_theory.md # 仕様解説ドキュメント
└── js/
    ├── OnomaPetDictionary.js   # 音象徴ベクトル推定 & 語構造解析エンジン
    ├── OnomaPetKinematics.js   # 10チャンネル運動力学・0-255ボリューム行列関数群
    ├── OnomaPetPhysics.js      # Euler物理演算 & モーラ音声リズムシーケンサー
    ├── OnomaPetSynth.js        # Formant/Noise/F0 音声合成Web Audioシンセサイザー
    ├── OnomaPetEngine.js       # 統合物理・音響ファサード & 15秒履歴バッファ
    ├── SeismographRenderer.js  # 2Dマルチチャンネル帯状記録紙レンダラー
    └── TenVariationsGallery.js # 10種動点バリエーションリアルタイム描画コンポーネント
```

---

## 6. デモの起動・確認方法 (Setup & Running Instructions)

1. ディレクトリ `c:\Users\richi\.antigravity\onomapet00` でローカルHTTPサーバーを起動します：
   ```bash
   python -m http.server 8000
   ```
2. ブラウザで `http://localhost:8000/index.html` を開きます。
3. ドロップダウンから「バシッ」「ねばねば」「さらさら」「ゆらーり」などを選択するか、任意のテキストを入力すると、地震計および下部の10種動点ギャラリーが連動変化します。
