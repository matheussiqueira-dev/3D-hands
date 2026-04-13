/**
 * Main Application Orchestrator
 * @author  Matheus Siqueira <https://www.matheussiqueira.dev/>
 */

import { HandTracker } from "./hand-tracker.js";
import { GestureRecognizer } from "./gesture-recognizer.js";
import { Scene3D } from "./scene-3d.js";
import { FPSCounter, generateSessionId, throttle } from "./utils.js";
import { API_CONFIG, UI_CONFIG } from "./config.js";

export class App {
  constructor() {
    this._sessionId  = generateSessionId(API_CONFIG.SESSION_ID_LENGTH);
    this._fps        = new FPSCounter(60);
    this._recognizer = new GestureRecognizer();
    this._history    = [];
    this._lastGesture = null;
    this._running    = false;
    this._dom        = {};
    this._logGesture = throttle((g, c) => this._postGestureEvent(g, c), API_CONFIG.LOG_INTERVAL_MS);
  }
  async init() {
    this._bindDom();
    this._initScene();
    this._initTracker();
    this._bindKeyboard();
    this._bindButtons();
    this._startTelemetry();
    this._setStatus("ready", "System ready");
  }

  _bindDom() {
    var ids=["video","overlay-canvas","scene-canvas","fps-display","gesture-display","status-text","start-btn","stop-btn","history-list"];
    for(var id of ids){var el=document.getElementById(id);if(!el)console.warn("[App] #"+id+" not found");this._dom[id]=el;}
  }

  _initScene() {
    var canvas=this._dom["scene-canvas"];
    if(!canvas)return;
    this._scene=new Scene3D(canvas);
    try{this._scene.init();this._scene.animate();}catch(err){this._setStatus("error","3D scene failed: "+err.message);}
  }

  _initTracker() {
    var video=this._dom["video"],overlay=this._dom["overlay-canvas"];
    if(!video||!overlay)return;
    this._tracker=new HandTracker(video,overlay);
    this._tracker.onResults(r=>this._handleResult(r));
    this._tracker.onError(err=>{this._setStatus("error",err.message);});
  }

  _handleResult(result) {
    this._fps.tick();
    var hand1=result.hands[0]?.landmarks??null;
    var hand2=result.hands[1]?.landmarks??null;
    if(!hand1){this._recognizer.reset();this._updateGestureDisplay("no hands");return;}
    var gestures=this._recognizer.recognize(hand1,hand2);
    var primary=this._recognizer.getPrimaryGesture(gestures);
    if(primary?.active){this._applyToScene(primary);this._updateGestureDisplay(primary.name,primary.confidence);this._recordHistory(primary.name,primary.confidence);this._logGesture(primary.name,primary.confidence);}else{this._updateGestureDisplay("tracking...");}
  }

  _applyToScene(gesture) {
    if(!this._scene)return;
    switch(gesture.name){
      case "open_palm":this._scene.translate(gesture.data.delta);this._scene.setAutoRotate(false);break;
      case "pinch":this._scene.zoom(gesture.data.distance<0.03?-1:1);break;
      case "two_fingers":this._scene.rotate(gesture.data.angle*0.05);break;
      case "fist":this._scene.reset();this._setStatus("info","Reset via fist");break;
      case "v_sign":this._scene.nextShape();this._recognizer.resetTimer("v_sign");this._setStatus("info","Shape: "+this._scene.currentShape);break;
      case "three_fingers":this._scene.nextColor();this._recognizer.resetTimer("three_fingers");break;
      case "dual_hands":if(gesture.data?.scaleDelta)this._scene.zoom(gesture.data.scaleDelta*10);break;
    }
  }

  _bindKeyboard() {
    var map={
      ArrowUp:()=>this._scene?.translate({x:0,y:-0.05}),
      ArrowDown:()=>this._scene?.translate({x:0,y:0.05}),
      ArrowLeft:()=>this._scene?.translate({x:-0.05,y:0}),
      ArrowRight:()=>this._scene?.translate({x:0.05,y:0}),
      r:()=>{this._scene?.reset();this._setStatus("info","Reset via keyboard");},
      n:()=>{this._scene?.nextShape();this._setStatus("info","Shape: "+this._scene?.currentShape);},
      c:()=>this._scene?.nextColor(),
      "+":()=>this._scene?.zoom(1),
      "-":()=>this._scene?.zoom(-1),
      " ":()=>this._scene?.setAutoRotate(true),
      Escape:()=>this.stop(),
    };
    document.addEventListener("keydown",e=>{var h=map[e.key];if(h){e.preventDefault();h();}});
  }

  _bindButtons() {
    this._dom["start-btn"]?.addEventListener("click",()=>this.start());
    this._dom["stop-btn"]?.addEventListener("click",()=>this.stop());
  }

  async start() {
    if(this._running)return;
    this._running=true;
    this._setStatus("loading","Initializing camera and hand tracking model...");
    await this._tracker?.start();
    this._setStatus("active","Hand tracking active");
    if(this._dom["start-btn"])this._dom["start-btn"].disabled=true;
    if(this._dom["stop-btn"])this._dom["stop-btn"].disabled=false;
  }

  stop() {
    if(!this._running)return;
    this._running=false;
    this._tracker?.stop();
    this._recognizer.reset();
    this._setStatus("ready","Tracking stopped");
    if(this._dom["start-btn"])this._dom["start-btn"].disabled=false;
    if(this._dom["stop-btn"])this._dom["stop-btn"].disabled=true;
  }

  _recordHistory(gesture,confidence) {
    if(gesture===this._lastGesture)return;
    this._lastGesture=gesture;
    this._history.unshift({gesture,confidence:Math.round(confidence*100),timestamp:new Date().toLocaleTimeString()});
    if(this._history.length>UI_CONFIG.HISTORY_MAX_ENTRIES)this._history.pop();
    this._renderHistory();
  }

  _renderHistory() {
    var list=this._dom["history-list"];
    if(!list)return;
    list.innerHTML=this._history.map(e=>
      "<li class="history-entry"><span class="history-gesture">"+(e.gesture.replace(/_/g," "))+"</span><span class="history-meta">"+(e.confidence)+"% &middot; "+(e.timestamp)+"</span></li>"
    ).join("");
  }

  async _postGestureEvent(gesture,confidence) {
    try{
      var res=await fetch(API_CONFIG.GESTURE_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({gesture,sessionId:this._sessionId,metadata:{confidence:Math.round(confidence*100)}})});
      if(!res.ok)console.warn("[App] API failed:",res.status);
    }catch(err){console.debug("[App] API unreachable:",err?.message);}
  }

  _updateGestureDisplay(gesture,confidence) {
    var el=this._dom["gesture-display"];
    if(!el)return;
    el.textContent=confidence?gesture.replace(/_/g," ")+" ("+Math.round(confidence*100)+"%)":gesture;
  }

  _setStatus(type,message) {
    var el=this._dom["status-text"];
    if(el){el.textContent=message;el.dataset.type=type;}
    console.log("[App]["+type.toUpperCase()+"] "+message);
  }

  _startTelemetry() {
    setInterval(()=>{var el=this._dom["fps-display"];if(el)el.textContent=this._fps.value+" FPS";},UI_CONFIG.FPS_UPDATE_INTERVAL_MS);
  }
}

document.addEventListener("DOMContentLoaded",async()=>{const app=new App();await app.init();window.__app=app;});
