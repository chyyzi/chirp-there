/* 《啾，在那里！》集中调参。修改并保存后刷新页面。
 * audio：默认音量 0～1，浏览器保存的滑杆优先；手册点「恢复音量设置」读回这里。
 * environments：normal=天空1常态，dusk=天空2普通结局，bad=天空3，dream=天空4。
 * 光照：sunIntensity=日光；hemiIntensity=阴影补光；sunDirection=[X,Y,Z]，Y 越低光线越斜。
 * 暗部：hemiGround=地面反弹光；fillIntensity=侧向补光；shadowStrength=投影浓度（0～1）。
 * 阴影：scene.shadowRadius=覆盖半径；shadowSize=贴图尺寸；默认只用一盏投影灯。
 * birds.species：路线鸟位置 / modelHeight（自动等比缩放）/ 模型、叫声、动作映射。
 * endingPerches：独立的终点三鸟；y 是树枝/树桩表面绝对高度。
 * inventory：数量、拾取距离、静止等待秒数；story：观察秒数、终点中心和触发半径。
 * 坐标是网页坐标：X=Blender X，Y=Blender Z，Z=-Blender Y。
 */
window.CHIRP_CONFIG = {
  "version": "2026.10.20-feeding-light",
  "scene": {
    "model": "assets/model/forest-final.glb",
    "pixelRatio": 1.5,
    "shadows": true,
    "shadowSize": 2048,
    "shadowRadius": 42,
    "shadowDistance": 90,
    "shadowBias": -0.00025,
    "shadowNormalBias": 0.035
  },
  "player": {
    "spawn": {
      "x": 4,
      "z": 36,
      "yaw": 0
    },
    "walkSpeed": 3.3,
    "runSpeed": 6,
    "crouchSpeed": 1.15,
    "height": 1.72,
    "eyeHeight": 1.6,
    "crouchHeight": 1.04,
    "crouchEyeHeight": 0.9,
    "radius": 0.28,
    "stepHeight": 0.38,
    "maxDrop": 3,
    "maxSlope": 55,
    "jumpSpeed": 4.5,
    "gravity": 14,
    "mouseSensitivity": 0.0021
  },
  "camera": {
    "fov": 70,
    "minZoom": 1,
    "maxZoom": 4,
    "zoomSpeed": 0.0015,
    "photoWidth": 1920,
    "maxPhotos": 60,
    "shotCooldown": 0.55
  },
  "audio": {
    "master": 0.75,
    "music": 0.18,
    "wind": 0.28,
    "water": 0.34,
    "walk": 0.42,
    "run": 0.58,
    "crouch": 0.16,
    "shutter": 0.42,
    "bird": 0.65,
    "heron": 0.8,
    "dove": 0.65,
    "bulbul": 0.55,
    "waterNear": 5,
    "waterFar": 30,
    "files": {
      "music": "bgm_forest.ogg",
      "wind": "wind_leaves_loop.ogg",
      "water": "water_lake_loop.ogg",
      "shutter": "camera_shutter.wav"
    },
    "grassSteps": [
      "footstep_grass_000.ogg",
      "footstep_grass_001.ogg",
      "footstep_grass_002.ogg",
      "footstep_grass_003.ogg",
      "footstep_grass_004.ogg"
    ],
    "woodSteps": [
      "footstep_wood_000.ogg",
      "footstep_wood_001.ogg",
      "footstep_wood_002.ogg",
      "footstep_wood_003.ogg",
      "footstep_wood_004.ogg"
    ]
  },
  "nature": {
    "wind": true,
    "strength": 0.8
  },
  "handbook": {
    "firstHintSeconds": 8
  },
  "birds": {
    "noticeDistance": 11,
    "dangerDistance": 7,
    "photoDistance": 24,
    "sprintAlertPerSecond": 90,
    "walkAlertPerSecond": 8,
    "crouchAlertPerSecond": 0,
    "calmPerSecond": 14,
    "alertThreshold": 35,
    "fleeThreshold": 100,
    "escapeSeconds": 2.8,
    "returnAfterSeconds": 35,
    "friendlySeconds": 5,
    "species": [
      {
        "id": "heron",
        "name": "夜鹭",
        "english": "Black-crowned night heron",
        "color": "#78b4cb",
        "x": -39.5,
        "z": 7.5,
        "perch": false,
        "model": "assets/model/birds/heron.glb",
        "call": "assets/audio/night_heron_call.mp3",
        "habitat": "水岸 · 木栈道旁",
        "note": "在水边停一停，蹲下，留给它一点安静。",
        "clips": {
          "idle": "Idle",
          "look": "Look",
          "alert": "Alert",
          "walk": "Walk",
          "friendly": "Friendly",
          "eat": "Friendly",
          "call": "Look",
          "flee": "Walk"
        },
        "modelHeight": 0.9,
        "yaw": 0
      },
      {
        "id": "bulbul",
        "name": "红耳鹎",
        "english": "Red-whiskered bulbul",
        "color": "#cf8073",
        "x": 5.46,
        "z": 11.59,
        "perch": true,
        "model": "assets/model/birds/bulbul.glb",
        "call": "assets/audio/red_whiskered_bulbul_call.mp3",
        "habitat": "林间 · 枝头附近",
        "note": "抬头寻找枝头的身影，用变焦保持观察距离。",
        "clips": {
          "idle": "Idle",
          "look": "Idle",
          "alert": "Idle",
          "walk": "Hop",
          "friendly": "Idle",
          "eat": "Idle",
          "call": "Call",
          "flee": "Hop"
        },
        "modelHeight": 0.43,
        "yaw": -1.5707963267948966,
        "y": 6.492
      },
      {
        "id": "dove",
        "name": "珠颈斑鸠",
        "english": "Spotted dove",
        "color": "#d3b66b",
        "x": 45,
        "z": -3,
        "perch": false,
        "model": "assets/model/birds/dove.glb",
        "call": "assets/audio/spotted_dove_call.mp3",
        "habitat": "高地 · 路边石块旁",
        "note": "沿右侧小路慢慢上坡，留意地面的小小动静。",
        "clips": {
          "idle": "Idle",
          "look": "Idle",
          "alert": "Idle",
          "walk": "Walk",
          "friendly": "Peck",
          "eat": "Peck",
          "call": "Idle",
          "flee": "Walk"
        },
        "modelHeight": 0.48,
        "yaw": 0
      }
    ],
    "crossFade": 0.28,
    "groundFeedSpecies": [
      "heron",
      "dove"
    ]
  },
  "environments": {
    "normal": {
      "ready": true,
      "skyTexture": "assets/images/sky1.png",
      "sky": "#d6e7e2",
      "fog": "#cbdcd9",
      "fogNear": 48,
      "fogFar": 175,
      "sun": "#fff0ce",
      "sunIntensity": 2.85,
      "hemiSky": "#deedf5",
      "hemiGround": "#d9d7cb",
      "hemiIntensity": 1.45,
      "exposure": 1.08,
      "filter": "none",
      "sunDirection": [
        -48,
        50,
        28
      ],
      "shadowStrength": 0.78,
      "fill": "#dce7ed",
      "fillIntensity": 0.6,
      "fillDirection": [
        38,
        24,
        -42
      ]
    },
    "dusk": {
      "ready": true,
      "inherit": "normal",
      "skyTexture": "assets/images/sky2.png",
      "fog": "#d6b99b",
      "fogNear": 40,
      "fogFar": 155,
      "sun": "#ffc087",
      "sunIntensity": 2.8,
      "hemiSky": "#d6e0ed",
      "hemiGround": "#d4c8bb",
      "hemiIntensity": 1.32,
      "exposure": 1.08,
      "filter": "sepia(0.06) saturate(1.04)",
      "sunDirection": [
        -60,
        29,
        25
      ],
      "shadowStrength": 0.72,
      "fill": "#d3dceb",
      "fillIntensity": 0.48
    },
    "bad": {
      "ready": true,
      "inherit": "normal",
      "skyTexture": "assets/images/sky3.png",
      "fog": "#8b9297",
      "fogNear": 34,
      "fogFar": 135,
      "sun": "#d4dbe1",
      "sunIntensity": 1.7,
      "hemiSky": "#ccd5de",
      "hemiGround": "#bdc2bf",
      "hemiIntensity": 1.2,
      "exposure": 1.03,
      "filter": "grayscale(1) contrast(1.04)",
      "sunDirection": [
        -42,
        55,
        32
      ],
      "shadowStrength": 0.82,
      "fill": "#c9d2da",
      "fillIntensity": 0.32
    },
    "dream": {
      "ready": true,
      "inherit": "normal",
      "skyTexture": "assets/images/sky4.png",
      "fog": "#d5cde4",
      "fogNear": 42,
      "fogFar": 165,
      "sun": "#ffe5d6",
      "sunIntensity": 2.65,
      "hemiSky": "#e6dffb",
      "hemiGround": "#dfd9d4",
      "hemiIntensity": 1.55,
      "exposure": 1.1,
      "filter": "saturate(1.06)",
      "sunDirection": [
        -45,
        44,
        30
      ],
      "shadowStrength": 0.72,
      "fill": "#e0e4f4",
      "fillIntensity": 0.52
    }
  },
  "inventory": {
    "initialBerries": 6,
    "maxBerries": 24,
    "spawnCount": 24,
    "pickupDistance": 2.8,
    "placeDistance": 3.5,
    "feedDistance": 7,
    "handWaitSeconds": 3,
    "foodLifetime": 90,
    "maxGroundFood": 8,
    "birdSpeed": 0.8,
    "endingFeedDistance": 8,
    "endingFeedAimAngle": 0.1,
    "endingFeedCooldown": 2.5,
    "endingFeedFlightSeconds": 0.85
  },
  "story": {
    "observeSeconds": 3,
    "finalRadius": 9,
    "final": {
      "x": 4.258,
      "z": -27
    },
    "transitionSeconds": 1.6,
    "badDisturbances": 2,
    "dreamFeedings": 2
  },
  "endingPerches": [
    {
      "id": "heron",
      "x": 1.6,
      "z": -27,
      "y": 1.625,
      "yaw": 0.4
    },
    {
      "id": "bulbul",
      "x": 5.25,
      "z": -30.63,
      "y": 6.024,
      "yaw": 0
    },
    {
      "id": "dove",
      "x": 8,
      "z": -34,
      "y": 3.441,
      "yaw": 0
    }
  ]
};
