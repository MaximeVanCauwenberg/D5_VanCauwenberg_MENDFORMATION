/*
  MENDFORMATION | ASSEMBLY + WELD | After Effects ExtendScript (.jsx)
  Timeline: 0-9 s fragment assembly, 9-14 s welding, 14-20 s logo hold.
  Run inside the ORIGINAL imported 'LOGO MOTION' composition containing all fragment layers.
  Safe to rerun: previously generated weld layers are removed, and Position
  keys on the selected fragments are replaced. Original final positions remain.

  For a composition with other artwork, SELECT ONLY the fragment layers first.
  If nothing is selected, all unlocked non-guide AV layers are animated.
*/
(function () {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        alert("Open your LOGO MOTION composition before running the script.");
        return;
    }
    var ASSEMBLY_END = 9.0;
    var WELD_END = 14.0;
    var TOTAL_TIME = 20.0;
    var PREFIX = "MF_WELD_";
    var i, j, layer, pos;
    var selected = comp.selectedLayers;
    var useSelection = selected && selected.length > 0;
    var candidates = [];
    var all = [];
    var result;

    // Use a repeatable pseudo-random sequence for consistent reruns.
    var seed = 72819;
    function rnd() {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
    }

    for (i = 1; i <= comp.numLayers; i++) {
        layer = comp.layer(i);
        if (layer.name.indexOf(PREFIX) === 0) continue;
        if (!(layer instanceof AVLayer) || layer.locked || layer.nullLayer || layer.guideLayer) continue;
        if (useSelection) {
            var included = false;
            for (j = 0; j < selected.length; j++) {
                if (layer === selected[j]) { included = true; break; }
            }
            if (!included) continue;
        }
        pos = layer.property("ADBE Transform Group").property("ADBE Position");
        if (!pos || pos.dimensionsSeparated) continue;
        all.push(layer);
    }
    if (all.length < 2) {
        alert("Select at least 2 separate logo fragment layers in LOGO MOTION, then run this again.");
        return;
    }

    app.beginUndoGroup("MENDFORMATION - Staggered Assembly and Welding");
    try {
        // Remove only effects created by previous runs of THIS script.
        for (i = comp.numLayers; i >= 1; i--) {
            layer = comp.layer(i);
            if (layer.name.indexOf(PREFIX) === 0) layer.remove();
        }
        if (comp.duration < TOTAL_TIME) comp.duration = TOTAL_TIME;
        comp.motionBlur = true;
        comp.shutterAngle = 180;

        // Shuffle animation order. Leave the stack order untouched.
        for (i = all.length - 1; i > 0; i--) {
            j = Math.floor(rnd() * (i + 1));
            layer = all[i]; all[i] = all[j]; all[j] = layer;
        }

        // Each piece flies for only 0.18-0.30 sec. Arrivals spread across ~9 sec.
        // For 50 pieces, new arrivals are about 0.17 sec apart.
        for (i = 0; i < all.length; i++) {
            layer = all[i];
            pos = layer.property("ADBE Transform Group").property("ADBE Position");
            // Previous script: final assembled position = final Position keyframe.
            // Fresh import: final assembled position = current Position value.
            var finalPos = pos.numKeys > 0 ? pos.keyValue(pos.numKeys) : pos.value;
            while (pos.numKeys > 0) pos.removeKey(pos.numKeys);
            var approach = 0.18 + rnd() * 0.12;
            var arrival = 0.45 + i * (ASSEMBLY_END - 0.60) / Math.max(1, all.length - 1);
            var launch = Math.max(0.0, arrival - approach);
            var angle = 2 * Math.PI * rnd();
            var dist = Math.max(comp.width, comp.height) * (0.75 + rnd() * 0.55);
            var initialPos = [finalPos[0] + Math.cos(angle) * dist, finalPos[1] + Math.sin(angle) * dist];
            if (finalPos.length === 3) initialPos.push(finalPos[2]);
            pos.setValueAtTime(0, initialPos);
            pos.setValueAtTime(launch, initialPos);
            pos.setValueAtTime(arrival, finalPos);
            for (j = 1; j <= pos.numKeys; j++) {
                pos.setInterpolationTypeAtKey(j, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
            }
            layer.motionBlur = true;
            if (layer.outPoint < TOTAL_TIME) layer.outPoint = TOTAL_TIME;
        }

        // ------------------ WELD VFX: REAL LOGO SEAMS ------------------
        // Seam coordinates are based on the geometric paths of Logos(1).ai,
        // NOT randomly generated comp-center lines.
        // All weld layers are parented to ONE alignment controller so you can
        // reposition/scale ALL trails together if the artwork was resized.
        // Coordinate source: actual stacked MENDFORMATION mark in Logos(1).ai.
        var LOGO_LEFT = 287.706, LOGO_TOP = 7.302;
        var LOGO_RIGHT = 699.912, LOGO_BOTTOM = 538.0;
        var logoW = LOGO_RIGHT - LOGO_LEFT;
        var logoH = LOGO_BOTTOM - LOGO_TOP;
        var weldWhite = [1, 0.97, 0.80];
        var weldYellow = [1, 0.70, 0.20];
        var weldOrange = [1, 0.27, 0.055];
        var weldRed = [0.84, 0.09, 0.14];
        var trace = [
            // These vertical and horizontal seams are measured from the
            // original Illustrator geometry and follow actual piece boundaries.
            [[321.684, 7.38], [321.684, 139.98]],
            [[416.741, 7.38], [416.741, 140.0]],
            [[500.471, 7.38], [500.471, 140.0]],
            [[287.706, 140.0], [500.471, 140.0]],
            [[500.471, 140.0], [699.912, 140.0]],
            [[382.763, 140.0], [382.763, 272.65]],
            [[500.471, 140.0], [500.471, 272.65]],
            [[287.706, 272.65], [500.471, 272.65]],
            [[382.763, 272.65], [382.763, 405.0]],
            [[500.471, 273.0], [500.471, 405.0]],
            [[287.706, 405.0], [500.471, 405.0]],
            [[500.471, 405.0], [699.912, 405.0]],
            [[416.741, 405.0], [416.741, 538.0]],
            [[500.471, 405.0], [500.471, 538.0]]
        ];
        // Keep everything within the real artwork silhouette bounds.
        function localPoint(point) {
            return [point[0] - LOGO_LEFT - logoW/2,
                    point[1] - LOGO_TOP - logoH/2];
        }
        function linearKeys(prop) {
            for (var k=1; k<=prop.numKeys; k++)
                prop.setInterpolationTypeAtKey(k,
                    KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
        }
        function addStrokeLine(label, a, b, width, color, t0, t1, coolDelay) {
            var l = comp.layers.addShape();
            l.name = PREFIX + label;
            l.inPoint = 0;
            l.outPoint = TOTAL_TIME;
            var root = l.property('ADBE Root Vectors Group');
            var group = root.addProperty('ADBE Vector Group');
            group.name = 'HEATED SEAM';
            var contents = group.property('ADBE Vectors Group');
            var shapeProp = contents.addProperty('ADBE Vector Shape - Group');
            var shape = new Shape();
            shape.vertices = [localPoint(a), localPoint(b)];
            shape.inTangents = [[0,0],[0,0]];
            shape.outTangents = [[0,0],[0,0]];
            shape.closed = false;
            shapeProp.property('ADBE Vector Shape').setValue(shape);
            var stroke = contents.addProperty('ADBE Vector Graphic - Stroke');
            stroke.property('ADBE Vector Stroke Color').setValue(color);
            stroke.property('ADBE Vector Stroke Width').setValue(width);
            // One animated trace per colour, then a delayed cool-down.
            var trim = contents.addProperty('ADBE Vector Filter - Trim');
            var end = trim.property('ADBE Vector Trim End');
            end.setValueAtTime(0,0);
            end.setValueAtTime(t0,0);
            end.setValueAtTime(t1,100);
            linearKeys(end);
            var opa = l.property('ADBE Transform Group').property('ADBE Opacity');
            opa.setValueAtTime(0,0);
            opa.setValueAtTime(t0,0);
            opa.setValueAtTime(t0+0.02,100);
            opa.setValueAtTime(t1+coolDelay,100);
            opa.setValueAtTime(Math.min(TOTAL_TIME-0.01,t1+coolDelay+0.6),0);
            linearKeys(opa);
            l.parent = align;
            l.property('ADBE Transform Group').property('ADBE Position').setValue([0,0]);
            l.property('ADBE Transform Group').property('ADBE Anchor Point').setValue([0,0]);
            return l;
        }
        function weldTip(label, a, b, t0, t1) {
            var tip = comp.layers.addShape();
            tip.name=PREFIX+'Torch_'+label;
            tip.inPoint=0; tip.outPoint=TOTAL_TIME;
            var root=tip.property('ADBE Root Vectors Group');
            var g=root.addProperty('ADBE Vector Group');
            var c=g.property('ADBE Vectors Group');
            var ellipse=c.addProperty('ADBE Vector Shape - Ellipse');
            ellipse.property('ADBE Vector Ellipse Size').setValue([14,14]);
            var f=c.addProperty('ADBE Vector Graphic - Fill');
            f.property('ADBE Vector Fill Color').setValue([1,0.97,0.85]);
            tip.parent=align;
            var tr=tip.property('ADBE Transform Group');
            tr.property('ADBE Anchor Point').setValue([0,0]);
            var pos=tr.property('ADBE Position');
            pos.setValueAtTime(0,localPoint(a));
            pos.setValueAtTime(t0,localPoint(a));
            pos.setValueAtTime(t1,localPoint(b));
            linearKeys(pos);
            var opacity=tr.property('ADBE Opacity');
            opacity.setValueAtTime(0,0);
            opacity.setValueAtTime(t0,0);
            opacity.setValueAtTime(t0+0.01,100);
            opacity.setValueAtTime(t1-0.01,100);
            opacity.setValueAtTime(t1+0.06,0);
            linearKeys(opacity);
        }
        var align = comp.layers.addNull();
        align.name = PREFIX + 'ALIGN_ME';
        align.threeDLayer = false;
        align.inPoint = 0;
        align.outPoint = TOTAL_TIME;
        align.label = 9;
        // Approximate initial fit. If AE scaled the artboard differently,
        // adjust ONLY this controller's Position and Scale at 10 seconds.
        var alignTransform = align.property('ADBE Transform Group');
        alignTransform.property('ADBE Position').setValue([comp.width/2, comp.height/2]);
        var fit = Math.min(comp.width * 0.36 / logoW,
                           comp.height * 0.50 / logoH) * 100;
        alignTransform.property('ADBE Scale').setValue([fit,fit]);
        // Twelve-plus real seams are traced in sequence between 9 and 14 s.
        // Different colours cool at different speeds, leaving a fading hot edge.
        for (i=0; i<trace.length; i++) {
            var a=trace[i][0], b=trace[i][1];
            var start=ASSEMBLY_END + i * 4.45/trace.length;
            var finish=Math.min(WELD_END-0.08,start + 0.22);
            var id='S'+(i+1)+'_';
            addStrokeLine(id+'Heat', a,b, 17, weldRed, start,finish, 1.35);
            addStrokeLine(id+'Glow', a,b, 11, weldOrange,start,finish, 0.85);
            addStrokeLine(id+'Hot', a,b, 5, weldYellow,start,finish, 0.32);
            addStrokeLine(id+'Core',a,b, 2.5,weldWhite,start,finish, 0.06);
            weldTip(id,a,b,start,finish);
        }
        // The original assembly is unchanged. ONLY welding was replaced.
        result = "Done! " + all.length + " pieces assemble one-by-one over " + ASSEMBLY_END + " seconds.\n" +
            "Measured weld seams: " + ASSEMBLY_END + "-" + WELD_END + " sec. Final hold until 20 sec.\n" +
            "Preview your LOGO MOTION composition from 0 sec.";
    } catch (err) {
        result = "Script error: " + err.toString() + "\nUndo once (Ctrl+Z) if needed.";
    }
    app.endUndoGroup();
    alert(result);
})();
