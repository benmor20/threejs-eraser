import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import https from "node:https";

function breakPutUrl(url) {
  const split_url = url.split(".com");
  const hostname = split_url[0].slice(8) + ".com";
  const path = split_url[1];
  return [hostname, path];
}

window.onload = () => {
  const model = new Model();
  new canvasController(model);
  new erasetoolController(model);
  new filesaveController(model);
};

function addVectors(v1, v2) {
  if (v1.length !== v2.length) {
    throw "Vector lengths do not match";
  }
  let ans = [];
  for (let idx = 0; idx < v1.length; idx++) {
    ans.push(v1[idx] + v2[idx]);
  }
  return ans;
}

function subtractVectors(v1, v2) {
  if (v1.length !== v2.length) {
    throw "Vector lengths do not match";
  }
  let ans = [];
  for (let idx = 0; idx < v1.length; idx++) {
    ans.push(v1[idx] - v2[idx]);
  }
  return ans;
}

function scaleVector(vec, scale) {
  let ans = [];
  for (let idx = 0; idx < vec.length; idx++) {
    ans.push(vec[idx] * scale);
  }
  return ans;
}

function vectorLength(vec) {
  let ans = 0;
  for (let idx = 0; idx < vec.length; idx++) {
    ans += vec[idx] ** 2;
  }
  return Math.sqrt(ans);
}

function normalize(vec) {
  return scaleVector(vec, 1.0 / vectorLength(vec));
}

function dot(v1, v2) {
  if (v1.length !== v2.length) {
    throw "Vector lengths do not match";
  }
  let ans = 0;
  for (let idx = 0; idx < v1.length; idx++) {
    ans += v1[idx] * v2[idx];
  }
  return ans;
}

function cross(v1, v2) {
  if (v1.length !== 3 || v2.length !== 3) {
    throw "Can only take cross product of two 3-element vectors";
  }
  return [
      v1[1] * v2[2] - v1[2] * v2[1],
      v1[2] * v2[0] - v1[0] * v2[2],
      v1[0] * v2[1] - v1[1] * v2[0]
  ]
}

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

    this.undoStack = [];
    this.redoStack = [];
    this.currentErase = {};

    this.loader = new GLTFLoader();
    this.get_url = "2011HondaOdysseyScan1.glb";
    // this.get_url = JSON.parse(document.getElementById("get_url").textContent);
    this.meshObj;
    this.loader.load(
      this.get_url,
      this.loadMeshobj.bind(this),
      undefined,
      function (error) {
        console.error(error);
      }
    );

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.exporter = new GLTFExporter();
    this.put_url =
      "https://vehicle-scans.nyc3.digitaloceanspaces.com/vehicle-scans/media/lidar/lidar_scans/lidar_scans/2011HondaOdysseyScan1_eehOOoM.glb?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=DO00J9E8NFVHDW4ZJCVD%2F20240323%2Fnyc3%2Fs3%2Faws4_request&X-Amz-Date=20240323T202630Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=d78cb3cfd59bf1c0a9db3a2b6bb90951252c914b350a9c609a903163a70bb908";
    [this.hostname, this.path] = breakPutUrl(this.put_url);

    this.mouseDown = false;
    this.eraseMode = false;
    this.eraseDistance = 0.05;

    // this.put_url = JSON.parse(document.getElementById("put_url").textContent);
    // [this.hostname, this.path] = breakPutUrl(this.put_url);
    // this.mouseDown = false;
    // this.eraseMode = false;
    // this.baseURI = document.getElementById("put_url").baseURI;
    // this.windshield_removal_index = JSON.parse(
    //   document.getElementById("windshield_removal_ext").innerText
    // ).indexOf("/", 1);
    // this.windshieldRemovalExt = JSON.parse(
    //   document.getElementById("windshield_removal_ext").innerText
    // ).slice(0, this.windshield_removal_index);

    // this.visualizationExt = JSON.parse(
    //   document.getElementById("visualization_ext").innerText
    // );

    // this.submitUrl =
    //   this.baseURI.slice(0, this.baseURI.indexOf(this.windshieldRemovalExt)) +
    //   this.visualizationExt;

    this.erasemodeSubscribers = [];

    this.animate();
  }

  numFaces() {
    return this.meshObj.geometry.index.array.length / 3;
  }

  subEraseMode(f) {
    this.erasemodeSubscribers.push(f);
  }

  eButtonClicked() {
    this.erasemodeSubscribers.forEach((f) => f());
  }

  toggleEraseMode() {
    this.eraseMode = !this.eraseMode;
    this.controls.enabled = !this.eraseMode;
    this.eButtonClicked();

    if (!this.eraseMode) {
      this.pushToUndoStack();
    }
  }

  pushToUndoStack() {
    if (Object.keys(this.currentErase).length > 0) {
      this.undoStack.push(this.currentErase);
      this.currentErase = {};
    }
  }

  undo() {
    if (this.undoStack.length === 0) {
      return;
    }
    const toUndo = this.undoStack.pop();
    for (const faceIdx in toUndo) {
      for (let component = 0; component < 3; component++) {
        this.meshObj.geometry.index.array[faceIdx * 3 + component] =
          toUndo[faceIdx][component];
      }
    }
    this.meshObj.geometry.index.needsUpdate = true;
    this.redoStack.push(toUndo);
  }

  redo() {
    if (this.redoStack.length === 0) {
      return;
    }
    const toRedo = this.redoStack.pop();
    for (const faceIdx in toRedo) {
      this.removeFace(faceIdx);
    }
    this.meshObj.geometry.index.needsUpdate = true;
    this.undoStack.push(toRedo);
  }

  resetMesh() {
    while (this.undoStack.length > 0) {
      this.undo();
    }
    this.redoStack = [];
  }

  loadMeshobj(gltf) {
    this.meshObj = gltf.scene.children[0];
    this.scene.add(this.meshObj);
  }

  getFace(faceIdx) {
    return [
      this.meshObj.geometry.index.array[faceIdx * 3],
      this.meshObj.geometry.index.array[faceIdx * 3 + 1],
      this.meshObj.geometry.index.array[faceIdx * 3 + 2],
    ];
  }

  removeFace(faceIdx) {
    for (let component = 0; component < 3; component++) {
      this.meshObj.geometry.index.array[faceIdx * 3 + component] = 0;
    }
  }

  getVertex(vertexIdx) {
    return [
        this.getVertexComponent(vertexIdx, 0),
        this.getVertexComponent(vertexIdx, 1),
        this.getVertexComponent(vertexIdx, 2)
    ];
  }

  getVertexComponent(vertexIdx, component) {
    return this.meshObj.geometry.attributes.position.array[
      vertexIdx * 3 + component
    ];
  }

  getFaceCenter(faceIdx) {
    let face = this.getFace(faceIdx);
    return scaleVector(
        addVectors(
            addVectors(
                this.getVertex(face[0]),
                this.getVertex(face[1])),
            this.getVertex(face[2])),
        1.0 / 3);
  }

  getFaceNormal(faceIdx) {
    let face = this.getFace(faceIdx);
    let vertex1 = this.getVertex(face[0]);
    let vertex2 = this.getVertex(face[1]);
    let vertex3 = this.getVertex(face[2]);
    let edge1 = subtractVectors(vertex2, vertex1);
    let edge2 = subtractVectors(vertex3, vertex1);
    return normalize(cross(edge1, edge2));
  }

  render() {
    // Set the pixel we're casting from
    this.raycaster.setFromCamera(this.pointer, this.camera);

    // Calculate intersections
    const intersects = this.raycaster.intersectObjects(this.scene.children);
    for (let i = 0; i < intersects.length; i++) {
      let intersectCenter = [intersects[i].point.x, intersects[i].point.y, intersects[i].point.z];
      let intersectNormal = [
          intersects[i].face.normal.x,
          intersects[i].face.normal.y,
          intersects[i].face.normal.z
      ];

      // Find each face whose center is close to the point
      for (let faceIdx = 0; faceIdx < this.numFaces(); faceIdx++) {
        let faceCenter = this.getFaceCenter(faceIdx);
        let distance = vectorLength(subtractVectors(faceCenter, intersectCenter));
        if (distance <= this.eraseDistance) {
          let faceNormal = this.getFaceNormal(faceIdx);
          let normalDot = dot(intersectNormal, faceNormal);
          if (normalDot > 0) {
            // Log the face in the current erase object
            this.currentErase[faceIdx] = this.getFace(faceIdx);
            this.removeFace(faceIdx);
            this.redoStack = [];
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

  saveFile(data) {
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: this.hostname,
          port: 443,
          path: this.path,
          method: "PUT",
          headers: {
            "Content-Length": new Blob([data]).size,
          },
        },
        (res) => {
          let responseBody = "";
          res.on("data", (chunk) => {
            responseBody += chunk;
          });
          res.on("end", () => {
            resolve(responseBody);
          });
        }
      );
      req.on("error", (err) => {
        reject(err);
      });
      req.write(data);
      req.end();
    });
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
    if (this.model.eraseMode) {
      this.model.pushToUndoStack();
    }
  }
}

class erasetoolController {
  constructor(m) {
    this.model = m;

    window.addEventListener("pointermove", (e) => this.onPointerMove(e));
    document.body.addEventListener("keydown", (e) => this.documentKeyDown(e));

    this.erase_button = document.getElementById("erase_button");
    this.erase_button.addEventListener("click", () =>
      this.model.toggleEraseMode()
    );

    this.reset_button = document.getElementById("reset_button");
    this.reset_button.addEventListener("click", () => this.model.resetMesh());

    this.undo_button = document.getElementById("undo_button");
    this.undo_button.addEventListener("click", () => this.model.undo());

    this.redo_button = document.getElementById("redo_button");
    this.redo_button.addEventListener("click", () => this.model.redo());

    this.slider = document.getElementById("dist_slider");
    this.slider.oninput = function () {
      m.eraseDistance = this.value / 100;
    };

    this.model.subEraseMode(() => this.switchButtonText());
  }
  documentKeyDown(e) {
    if (e.key === "e" || e.key === "E") {
      this.model.toggleEraseMode();
    }
    if ((e.key === "z" || e.key === "Z") && e.ctrlKey) {
      this.model.undo();
    }
    if ((e.key === "y" || e.key === "Y") && e.ctrlKey) {
      this.model.redo();
    }
  }
  onPointerMove(e) {
    // calculate pointer position in normalized device coordinates
    // (-1 to +1) for both components

    let rect = e.target.getBoundingClientRect();
    this.model.pointer.x =
      ((e.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1;
    this.model.pointer.y =
      -((e.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1;
  }
  switchButtonText() {
    if (this.model.eraseMode) {
      this.erase_button.innerText = "Turn Off Erase Mode";
    } else {
      this.erase_button.innerText = "Turn On Erase Mode";
    }
  }
}

class filesaveController {
  constructor(m) {
    this.model = m;

    this.submit_button = document.getElementById("submit_button");
    this.submit_button.addEventListener("click", () =>
      this.handleSubmitClick()
    );
  }
  handleSubmitClick() {
    this.model.exporter.parse(
      this.model.meshObj,
      async (result) => {
        const data = JSON.stringify(result);
        await this.model.saveFile(data);
        // const link = document.createElement("a");
        // link.href = this.model.submitUrl;
        // link.click();
      },
      {}
    );
  }
}
