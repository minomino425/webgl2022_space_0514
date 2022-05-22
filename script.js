// = 009 ======================================================================
// これまでのサンプルでは、メッシュは「１つのジオメトリから１つ」ずつ生成してい
// ましたが、実際の案件では、同じジオメトリを再利用しながら「複数のメッシュ」を
// 生成する場面のほうが多いかもしれません。
// このとき、3D シーンに複数のオブジェクトを追加する際にやってしまいがちな間違い
// として「ジオメトリやマテリアルも複数回生成してしまう」というものがあります。
// メモリ効率よく複数のオブジェクトをシーンに追加する方法をしっかりおさえておき
// ましょう。
// ============================================================================

// 必要なモジュールを読み込み
import * as THREE from "/lib/three.module.js";
import { OrbitControls } from "/lib/OrbitControls.js";

// DOM がパースされたことを検出するイベントを設定
window.addEventListener(
  "DOMContentLoaded",
  () => {
    // 制御クラスのインスタンスを生成
    const app = new App3();
    // 初期化
    app.init();
    // 描画
    app.render();
  },
  false
);

/**
 * three.js を効率よく扱うために自家製の制御クラスを定義
 */
class App3 {
  /**
   * カメラ定義のための定数
   */
  static get CAMERA_PARAM() {
    return {
      // fovy は Field of View Y のことで、縦方向の視野角を意味する
      fovy: 30,
      // 描画する空間のアスペクト比（縦横比）
      aspect: window.innerWidth / window.innerHeight,
      // 描画する空間のニアクリップ面（最近面）
      near: 0.01,
      // 描画する空間のファークリップ面（最遠面）
      far: 200.0,
      // カメラの位置
      x: 0.0,
      y: 2.0,
      z: 70.0,
      // カメラの中止点
      lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
    };
  }
  /**
   * レンダラー定義のための定数
   */
  static get RENDERER_PARAM() {
    return {
      // レンダラーが背景をリセットする際に使われる背景色
      clearColor: 0x000000,
      // レンダラーが描画する領域の横幅
      width: window.innerWidth,
      // レンダラーが描画する領域の縦幅
      height: window.innerHeight,
    };
  }
  /**
   * ディレクショナルライト定義のための定数
   */
  static get DIRECTIONAL_LIGHT_PARAM() {
    return {
      color: 0xffffff, // 光の色
      intensity: 1.0, // 光の強度
      x: 1.0, // 光の向きを表すベクトルの X 要素
      y: 0.8, // 光の向きを表すベクトルの Y 要素
      z: 0.0, // 光の向きを表すベクトルの Z 要素
    };
  }
  /**
   * アンビエントライト定義のための定数
   */
  static get AMBIENT_LIGHT_PARAM() {
    return {
      color: 0xffffff, // 光の色
      intensity: 0.2, // 光の強度
    };
  }
  /**
   * マテリアル定義のための定数
   */
  static get MATERIAL_PARAM() {
    return {
      color: 0xffec50, // マテリアルの基本色
    };
  }
  /**
   * マテリアル定義のための定数 地球
   */
  static get MATERIAL_PARAM_EARTH() {
    return {
      color: 0x0000ff, // 青色
    };
  }

  /**
   * コンストラクタ
   * @constructor
   */
  constructor() {
    this.renderer; // レンダラ
    this.scene; // シーン
    this.camera; // カメラ
    this.directionalLight; // ディレクショナルライト
    this.ambientLight; // アンビエントライト
    this.material; // マテリアル
    this.materialEarth; //地球マテリアル
    this.earth; // 地球オブジェクト
    this.boxGeometry; // トーラスジオメトリ
    this.earthGeometry; //地球
    this.boxArray; // トーラスメッシュの配列 @@@
    this.shootings = [];

    this.controls; // オービットコントロール
    this.axesHelper; // 軸ヘルパー
    this.scaleXZ = 1000;

    this.isDown = false; // キーの押下状態を保持するフラグ

    // 再帰呼び出しのための this 固定
    this.render = this.render.bind(this);

    // キーの押下や離す操作を検出できるようにする
    window.addEventListener(
      "keydown",
      (keyEvent) => {
        switch (keyEvent.key) {
          case " ":
            this.isDown = true;
            break;
          default:
        }
      },
      false
    );
    window.addEventListener(
      "keyup",
      (keyEvent) => {
        this.isDown = false;
      },
      false
    );

    // リサイズイベント
    window.addEventListener(
      "resize",
      () => {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
      },
      false
    );
  }

  /**
   * 初期化処理
   */
  init() {
    // レンダラー
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setClearColor(
      new THREE.Color(App3.RENDERER_PARAM.clearColor)
    );
    this.renderer.setSize(
      App3.RENDERER_PARAM.width,
      App3.RENDERER_PARAM.height
    );
    const wrapper = document.querySelector("#webgl");
    wrapper.appendChild(this.renderer.domElement);

    // シーン
    this.scene = new THREE.Scene();

    // カメラ
    this.camera = new THREE.PerspectiveCamera(
      App3.CAMERA_PARAM.fovy,
      App3.CAMERA_PARAM.aspect,
      App3.CAMERA_PARAM.near,
      App3.CAMERA_PARAM.far
    );
    this.camera.position.set(
      App3.CAMERA_PARAM.x,
      App3.CAMERA_PARAM.y,
      App3.CAMERA_PARAM.z
    );
    this.camera.lookAt(App3.CAMERA_PARAM.lookAt);

    // ディレクショナルライト（平行光源）
    this.directionalLight = new THREE.DirectionalLight(
      App3.DIRECTIONAL_LIGHT_PARAM.color,
      App3.DIRECTIONAL_LIGHT_PARAM.intensity
    );
    this.directionalLight.position.set(
      App3.DIRECTIONAL_LIGHT_PARAM.x,
      App3.DIRECTIONAL_LIGHT_PARAM.y,
      App3.DIRECTIONAL_LIGHT_PARAM.z
    );
    this.scene.add(this.directionalLight);

    // アンビエントライト（環境光）
    this.ambientLight = new THREE.AmbientLight(
      App3.AMBIENT_LIGHT_PARAM.color,
      App3.AMBIENT_LIGHT_PARAM.intensity
    );
    this.scene.add(this.ambientLight);

    // マテリアル
    this.material = new THREE.MeshPhongMaterial(App3.MATERIAL_PARAM);
    this.materialEarth = new THREE.MeshPhongMaterial(App3.MATERIAL_PARAM_EARTH);

    // 共通のジオメトリ、マテリアルから、複数のメッシュインスタンスを作成する @@@
    const STAR_COUNT = 300;
    const TRANSFORM_SCALE = 30.0;
    this.boxGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    this.earthGeometry = new THREE.BoxGeometry(5, 5, 5);

    this.boxArray = [];
    for (let i = 0; i < STAR_COUNT; ++i) {
      // トーラスメッシュのインスタンスを生成
      const stars = new THREE.Mesh(this.boxGeometry, this.material);
      // 座標をランダムに散らす
      stars.position.x = (Math.random() * 2.0 - 1.0) * TRANSFORM_SCALE;
      stars.position.y = (Math.random() * 2.0 - 1.0) * TRANSFORM_SCALE;
      stars.position.z = (Math.random() * 2.0 - 1.0) * TRANSFORM_SCALE;
      // シーンに追加する
      this.scene.add(stars);
      // 配列に入れておく
      this.boxArray.push(stars);
    }

    for (let i = 0; i < 8; ++i) {
      this.shootings.push(Math.floor(Math.random() * this.boxArray.length));
    }


    this.earth = new THREE.Mesh(this.earthGeometry, this.materialEarth);
    this.scene.add(this.earth);

    // コントロール
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    // ヘルパー
    // const axesBarLength = 5.0;
    // this.axesHelper = new THREE.AxesHelper(axesBarLength);
    // this.scene.add(this.axesHelper);
  }

  /**
   * 描画処理
   */
  render() {
    // 恒常ループの設定
    requestAnimationFrame(this.render);

    // コントロールを更新
    this.controls.update();

    // フラグに応じてオブジェクトの状態を変化させる
    if (this.isDown === true) {
      // 流れ星
      for (const shooting of this.shootings) {
        this.boxArray[shooting].position.x += 1;
        this.boxArray[shooting].position.y -= 0.5;
      }
    }

    this.earth.rotation.y += 0.01;

    // レンダラーで描画
    this.renderer.render(this.scene, this.camera);
  }
}
