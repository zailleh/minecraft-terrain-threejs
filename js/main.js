class MCEnvironment {
  constructor() {
    this.renderer = new THREE.WebGLRenderer();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      45, // FoV
      window.innerWidth / window.innerHeight, // Ratio
      0.1, // near
      1000 // far
    );

    this.tick = this.tick.bind(this);

    // add some lights to the scene
    this.scene.add(this.createLight(1, 10));
    this.scene.add(this.createLight(0.5, -10));

    // x: -59.4890804496197, y: 91.05971534730678, z: -63.95753916107502
    this.camera.position.set(-60, 90, -60);
    this.camera.lookAt(0, 0, 0); // get rid of this later

    // chunk settings
    noise.seed(Math.random());
    this.chunkSize = 16;
    this.heightMultiplier = 100;
    this.widthMultiplier = 50;

    // block settings
    this.blockSize = 10;

    // Initialise when the document is ready
    document.addEventListener("DOMContentLoaded", this.init.bind(this));
  }

  init() {
    // set up the canvas and renderer
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setClearColor('#000000');
    document.body.appendChild(this.renderer.domElement);

    // enable camera controls
    this.controls = new THREE.OrbitControls(
      this.camera,
      this.renderer.domElement
    );


    // add a cube
    // this.generateCube();
    this.generateChunk();

    // begin tick
    this.tick();
  }

  generateChunk() {
    for (let x = 0; x < this.chunkSize; x++) {
      for (let z = 0; z < this.chunkSize; z++) {
        const xFreq = x / this.widthMultiplier;
        const zFreq = z / this.widthMultiplier;

        const height = noise.simplex2(xFreq, zFreq) * this.heightMultiplier // simplex noise between -1 and 1
        this.generateCube(x * this.blockSize, z * this.blockSize, height)
      }
    }
  }

  generateCube(x = 0, z = 0, height = 0) {
    // create material
    this.material = new THREE.MeshLambertMaterial({ color: 'green' });
    // create geometry
    this.geometry = new THREE.BoxGeometry(this.blockSize, this.blockSize, this.blockSize);
    // create mesh
    const cube = new THREE.Mesh(this.geometry, this.material);
    cube.position.set(x, height, z);

    // add to scene
    this.scene.add(cube);

    return cube;
  }

  createLight(strength, direction) {
    const light = new THREE.DirectionalLight(0xffffff, strength);
    light.castShadow = true;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;

    light.position.set(direction, 10, direction);
    return light
  }

  tick() {
    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame(this.tick);
  }
}

const env = new MCEnvironment();