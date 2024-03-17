import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

window.onload = () => {
  const model = new Model();
  new canvasController(model);
  new erasetoolViewer(model);
  new erasetoolController(model);
};

class Model {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.z = 5;

    this.light = new THREE.AmbientLight(0xffffff); // soft white light
    this.scene.add(this.light);

    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "500px";

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.update();

    this.loader = new GLTFLoader();
    this.meshObj;
    this.loader.load(
      "./2011HondaOdysseyScan1.glb",
      this.loadMeshobj.bind(this),
      undefined,
      function (error) {
        console.error(error);
      }
    );

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    console.log(window.innerWidth, window.innerHeight);

    this.mouseDown = false;
    this.eraseMode = false;

    this.erasemodeSubscribers = [];

    this.animate();
  }

  subEraseMode(f) {
    this.erasemodeSubscribers.push(f);
  }

  eButtonClicked() {
    this.erasemodeSubscribers.forEach((f) => f());
  }

  loadMeshobj(gltf) {
    this.meshObj = gltf.scene.children[0];
    this.scene.add(this.meshObj);
  }

  render() {
    // Set the pixel we're casting from
    this.raycaster.setFromCamera(this.pointer, this.camera);

    // Calculate intersections
    const intersects = this.raycaster.intersectObjects(this.scene.children);
    for (let i = 0; i < intersects.length; i++) {
      let vertices = [
        intersects[i].face.a,
        intersects[i].face.b,
        intersects[i].face.c,
      ];

      // Find each face that shares at least one vertex with the face to remove
      for (
        let faceIdx = 0;
        faceIdx < this.meshObj.geometry.index.array.length / 3;
        faceIdx++
      ) {
        let faceVertex1 = this.meshObj.geometry.index.array[faceIdx * 3];
        let faceVertex2 = this.meshObj.geometry.index.array[faceIdx * 3 + 1];
        let faceVertex3 = this.meshObj.geometry.index.array[faceIdx * 3 + 2];

        if (
          vertices.includes(faceVertex1) ||
          vertices.includes(faceVertex2) ||
          vertices.includes(faceVertex3)
        ) {
          // "Remove" the face (set all points of the face to vertex 0)
          for (let component = 0; component < 3; component++) {
            this.meshObj.geometry.index.array[faceIdx * 3 + component] = 0;
          }
        }
      }
    }
    this.meshObj.geometry.index.needsUpdate = true;

    this.renderer.render(this.scene, this.camera);
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.renderer.render(this.scene, this.camera);
  }
}

class canvasController {
  constructor(m) {
    this.model = m;
    this.viewer = document.getElementById("canvas_viewer");
    this.viewer.appendChild(this.model.renderer.domElement);

    this.viewer.addEventListener("mousedown", () => this.documentMouseDown());
    this.viewer.addEventListener("mousemove", (e) => this.documentMouseMove(e));
    this.viewer.addEventListener("mouseup", () => this.documentMouseUp());
  }
  documentMouseDown() {
    this.model.mouseDown = true;
  }
  documentMouseMove(e) {
    if (this.model.mouseDown && this.model.eraseMode) {
      window.requestAnimationFrame(this.model.render.bind(this.model));
    }
  }
  documentMouseUp() {
    this.model.mouseDown = false;
  }
}

class erasetoolViewer {
  constructor(m) {
    this.model = m;
    this.eraseMessage = document.getElementById("erase_mode");
    this.model.subEraseMode(() => this.toggleEraseMessage());
  }
  toggleEraseMessage() {
    if (this.eraseMessage.style.display == "none") {
      this.eraseMessage.style.display = "block";
    } else {
      this.eraseMessage.style.display = "none";
    }
  }
}

class erasetoolController {
  constructor(m) {
    this.model = m;

    window.addEventListener("pointermove", (e) => this.onPointerMove(e));
    document.body.addEventListener("keydown", (e) => this.documentKeyDown(e));
  }
  documentKeyDown(e) {
    if (e.key === "e" || e.key === "E") {
      this.model.eraseMode = !this.model.eraseMode;
      this.model.controls.enabled = !this.model.eraseMode;
      this.model.eButtonClicked();
    }
  }
  onPointerMove(e) {
    // calculate pointer position in normalized device coordinates
    // (-1 to +1) for both components

    let rect = e.target.getBoundingClientRect();
    this.model.pointer.x =
      ((e.clientX - rect.left) / window.innerWidth) * 2 - 1;
    this.model.pointer.y =
      -((e.clientY - rect.top) / window.innerHeight) * 2 + 1;
  }
}
