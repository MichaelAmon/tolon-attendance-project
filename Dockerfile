providers = ["node"]

[phases.setup]
nixPkgs = ["nodejs-18_x"]

[phases.install]
cmds = ["npm install --omit=dev"]

[phases.build]
cmds = []  # Leave empty if no build script

[start]
cmd = "node server/index.js"
