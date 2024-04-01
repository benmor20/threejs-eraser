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
  new erasetoolViewer(model);
  new erasetoolController(model);
  new filesaveController(model);
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
    this.get_url = "2011HondaOdysseyScan1.glb";
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

    // this.baseURI = document.getElementById("put_url").baseURI;
    // this.windshieldRemovalExt = JSON.parse(
    //   document.getElementById("windshield_removal_ext").innerText
    // ).slice(0, -2);
    // this.addVehicleExt = JSON.parse(
    //   document.getElementById("add_vehicle_ext").innerText
    // );
    // this.submitUrl =
    //   this.baseURI.slice(0, this.baseURI.indexOf(this.windshieldRemovalExt)) +
    //   this.addVehicleExt;

    this.erasemodeSubscribers = [];

    this.animate();
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

    this.erase_button = document.getElementById("erase_button");
    this.erase_button.addEventListener("click", () =>
      this.model.toggleEraseMode()
    );
  }
  documentKeyDown(e) {
    if (e.key === "e" || e.key === "E") {
      this.model.toggleEraseMode();
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
