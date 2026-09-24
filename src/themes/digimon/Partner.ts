import * as THREE from 'three';
import { box, cel, ellipsoid, part, rod } from '../animation/parts';

export const PARTNER_FORMS = ['agumon', 'greymon', 'metalgreymon', 'wargreymon'] as const;

/** Low-poly armor plates, with thickness so both sides read from the studio camera. */
function plate(parent: THREE.Group, points: number[][], material: THREE.Material) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => { if (i) shape.lineTo(x, y); else shape.moveTo(x, y); });
  shape.closePath();
  return part(parent, new THREE.ExtrudeGeometry(shape, { depth: .07, bevelEnabled: false }), material);
}

function createWarrior(gradient: THREE.Texture) {
  const root = new THREE.Group(), head = new THREE.Group();
  const gold = cel('#eab64a', gradient), orange = cel('#c87532', gradient), navy = cel('#344b50', gradient);
  const steel = cel('#c1d2cd', gradient), darkSteel = cel('#687f7c', gradient), red = cel('#b75839', gradient);
  const eyes = new THREE.MeshBasicMaterial({ color: '#81d8c5' });
  const arms: THREE.Group[] = [], shields: THREE.Group[] = [];
  ellipsoid(root, .57, [1.12, 1.1, .77], orange, [0, 1.25, 0]);
  ellipsoid(root, .42, [1.12, .58, .82], navy, [0, .87, .02]);
  // Split chest plate and silver abdominal armor keep the final stage humanoid.
  for (const side of [-1, 1]) {
    const chest = box(root, [.52, .48, .26], gold, [side * .28, 1.48, .4], .1); chest.rotation.z = side * .15;
    ellipsoid(root, .24, [1, 1.65, 1], orange, [side * .35, .56, .01]);
    box(root, [.42, .47, .39], gold, [side * .37, .32, .15], .08);
    box(root, [.46, .22, .66], gold, [side * .38, .12, .29], .06);
    for (let i = -1; i <= 1; i++) {
      const toe = part(root, new THREE.ConeGeometry(.055, .23, 6), steel, side * .38 + i * .14, .1, .68); toe.rotation.x = Math.PI / 2;
    }
    const arm = new THREE.Group(); arm.position.set(side * .65, 1.55, .04); arm.rotation.z = side * .14; root.add(arm); arms.push(arm);
    ellipsoid(arm, .33, [1.1, .9, .92], gold, [side * .03, -.02, 0]);
    ellipsoid(arm, .22, [.9, 1.35, .95], orange, [side * .12, -.3, .06]);
    // Dramon gauntlets: three long, flat silver blades on each hand.
    box(arm, [.47, .57, .49], gold, [side * .15, -.6, .18], .08);
    box(arm, [.39, .17, .51], darkSteel, [side * .15, -.37, .18], .03);
    for (let i = -1; i <= 1; i++) {
      const blade = part(arm, new THREE.ConeGeometry(.084, .69, 4), steel, side * .15 + i * .15, -.66, .72);
      blade.rotation.x = Math.PI / 2; blade.scale.z = .48;
    }
    const shield = new THREE.Group(); shield.position.set(side * .16, 1.6, -.42); shield.rotation.y = side * -.55;
    root.add(shield); shields.push(shield);
    plate(shield, [[0, -.68], [side * 1.15, -.27], [side * .92, .98], [side * .08, .65]], gold);
    rod(shield, new THREE.Vector3(side * .16, -.4, .09), new THREE.Vector3(side * .8, .7, .09), .037, orange);
    // Half a courage crest on each Brave Shield wing.
    for (let i = 0; i < 4; i++) {
      const ray = box(shield, [.045, .22, .024], orange, [side * .54 + Math.sin(i * Math.PI / 2) * .2, .22 + Math.cos(i * Math.PI / 2) * .2, .09], 0);
      ray.rotation.z = -i * Math.PI / 2;
    }
  }
  for (let i = 0; i < 3; i++) box(root, [.45 - i * .04, .1, .15], steel, [0, 1.2 - i * .14, .44], .02);
  head.position.set(0, 2.06, .03); root.add(head);
  ellipsoid(head, .41, [1.02, 1.12, .9], gold, [0, .12, 0]);
  box(head, [.51, .22, .23], navy, [0, .08, .34], .03);
  for (const side of [-1, 1]) {
    const eye = box(head, [.15, .055, .025], eyes, [side * .14, .105, .468], .008); eye.rotation.z = side * .15;
    const horn = part(head, new THREE.ConeGeometry(.105, .63, 6), steel, side * .3, .6, .04); horn.rotation.z = side * -.27;
    ellipsoid(head, .19, [.55, 1.5, .85], gold, [side * .35, -.02, .14]);
  }
  box(head, [.22, .25, .21], gold, [0, -.05, .4], .025);
  // The swept red mane remains visible behind the helmet.
  for (let i = -2; i <= 2; i++) {
    const hair = part(head, new THREE.ConeGeometry(.105, .55, 5), red, i * .14, .27, -.38);
    hair.rotation.x = -.9 - Math.abs(i) * .1;
  }
  root.visible = false;
  return { root, head, arms, shields };
}

/** A small, locally modeled Agumon. The skull and stripes are geometry, not a recolor. */
export function createPartner(gradient: THREE.Texture) {
  const root = new THREE.Group(), head = new THREE.Group(), tail = new THREE.Group(), armor = new THREE.Group(), stripes = new THREE.Group();
  const skin = cel('#efb84f', gradient), cream = cel('#f6e6ba', gradient), ink = cel('#273c35', gradient);
  const skull = cel('#826443', gradient), stripe = cel('#466c78', gradient), green = cel('#719f67', gradient);
  ellipsoid(root, .62, [.92, 1.3, .86], skin, [0, .91, 0]);
  ellipsoid(root, .48, [.88, 1.1, .23], cream, [0, .85, .48]);
  head.position.set(0, 1.75, .12); root.add(head);
  ellipsoid(head, .6, [1.12, .92, .96], skin, [0, .15, 0]);
  ellipsoid(head, .5, [1.21, .58, 1.02], skin, [0, -.05, .5]);
  const jaw = ellipsoid(head, .47, [1.12, .25, .93], cream, [0, -.26, .48]);
  const smile = new THREE.CatmullRomCurve3([new THREE.Vector3(-.44, -.19, .76), new THREE.Vector3(0, -.21, .98), new THREE.Vector3(.44, -.19, .76)]);
  part(head, new THREE.TubeGeometry(smile, 12, .015, 5, false), ink);
  const arms: THREE.Group[] = [], eyes: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    ellipsoid(head, .165, [.95, 1.25, .36], cream, [side * .4, .27, .49]);
    ellipsoid(head, .109, [.8, 1.23, .42], green, [side * .4, .27, .542]);
    eyes.push(ellipsoid(head, .059, [.7, 1.34, .38], ink, [side * .395, .27, .578]));
    ellipsoid(head, .024, [1, 1, .4], cream, [side * .4 - .017, .306, .601]);
    ellipsoid(head, .028, [1, .6, .5], ink, [side * .18, .105, .937]);
    const arm = new THREE.Group(); arm.position.set(side * .49, 1.2, .04); arm.rotation.z = side * .2; root.add(arm); arms.push(arm);
    ellipsoid(arm, .21, [.82, 1.5, .85], skin, [side * .05, -.18, .12]);
    ellipsoid(arm, .22, [1, .7, 1], skin, [side * .08, -.44, .21]);
    ellipsoid(root, .32, [1, 1.13, .91], skin, [side * .34, .37, -.01]);
    ellipsoid(root, .28, [1.02, .52, 1.58], skin, [side * .36, .13, .22]);
    for (let i = -1; i <= 1; i++) {
      const claw = part(root, new THREE.ConeGeometry(.064, .24, 8), cream, side * .36 + i * .135, .11, .66);
      claw.rotation.x = Math.PI / 2;
      const finger = part(arm, new THREE.ConeGeometry(.042, .18, 8), cream, side * .08 + i * .12, -.44, .45);
      finger.rotation.x = Math.PI / 2;
    }
    // Broad blue side markings and a three-horn skull identify the evolved form.
    for (let i = 0; i < 3; i++) {
      const mark = ellipsoid(stripes, .23, [.17, .46, 1.85 - i * .25], stripe, [side * (.51 - i * .07), 1.1 - i * .23, .08]);
      mark.rotation.z = side * -.3;
    }
    const horn = part(armor, new THREE.ConeGeometry(.19, 1.04, 9), cream, side * .75, .72, .08);
    horn.rotation.z = side * -.88;
  }
  root.add(stripes); head.add(armor);
  const helmet = part(armor, new THREE.SphereGeometry(.63, 20, 12, 0, Math.PI * 2, 0, Math.PI * .48), skull, 0, .17, -.04);
  helmet.scale.set(1.17, 1.08, 1);
  for (const side of [-1, 1]) ellipsoid(armor, .28, [.65, 1.35, .78], skull, [side * .57, .1, -.13]);
  const brow = ellipsoid(armor, .3, [1.05, .36, 1.25], skull, [0, .31, .48]); brow.rotation.x = -.13;
  const noseHorn = part(armor, new THREE.ConeGeometry(.16, .78, 9), cream, 0, .44, 1.02); noseHorn.rotation.x = .9;
  tail.position.set(0, .5, -.34); root.add(tail);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(.25, -.16, -.55), new THREE.Vector3(.67, -.16, -.93), new THREE.Vector3(.84, .04, -1.06)]);
  // Tapered linked pieces keep a tangible toy silhouette at mobile scale.
  const points = curve.getPoints(6);
  for (let i = 0; i < points.length - 1; i++) rod(tail, points[i], points[i + 1], .18 * (1 - i / 7), skin);
  // MetalGreymon reuses the dinosaur underneath a real cybernetic upgrade.
  const cyberBody = new THREE.Group(), cyberHead = new THREE.Group(), cyberArm = new THREE.Group();
  const steel = cel('#aabfba', gradient), darkSteel = cel('#526b70', gradient), wingMaterial = cel('#887392', gradient);
  root.add(cyberBody); head.add(cyberHead); arms[0].add(cyberArm);
  const face = ellipsoid(cyberHead, .62, [.61, .93, 1.03], steel, [-.31, .14, .015]); face.rotation.z = -.15;
  box(cyberHead, [.32, .09, .1], darkSteel, [-.4, .27, .61], .02);
  box(cyberHead, [.18, .035, .02], new THREE.MeshBasicMaterial({ color: '#e39a63' }), [-.4, .28, .669], .004);
  for (let i = 0; i < 3; i++) box(cyberHead, [.12, .027, .04], darkSteel, [-.46, .04 - i * .075, .55], .005);
  box(cyberBody, [.89, .56, .3], steel, [0, 1, .49], .08);
  for (const side of [-1, 1]) {
    const port = part(cyberBody, new THREE.CylinderGeometry(.16, .16, .09, 12), darkSteel, side * .25, 1.04, .69); port.rotation.x = Math.PI / 2;
    ellipsoid(cyberBody, .105, [1, 1, .5], cream, [side * .25, 1.04, .75]);
  }
  ellipsoid(cyberArm, .35, [1, .9, .95], steel, [-.08, -.05, .02]);
  box(cyberArm, [.4, .54, .43], steel, [-.09, -.37, .2], .06);
  for (let i = -1; i <= 1; i++) {
    const claw = part(cyberArm, new THREE.ConeGeometry(.075, .55, 6), steel, -.08 + i * .17, -.48, .64); claw.rotation.x = Math.PI / 2;
  }
  const wings: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Group(); wing.position.set(side * .3, 1.35, -.36); wing.rotation.y = side * -.2; cyberBody.add(wing); wings.push(wing);
    plate(wing, [[0, 0], [side * .43, 1.18], [side * 1.24, 1.04], [side * .98, .48], [side * .77, .67], [side * .57, .17], [side * .34, .32]], wingMaterial);
    rod(wing, new THREE.Vector3(0, 0, .09), new THREE.Vector3(side * .43, 1.18, .09), .045, darkSteel);
    rod(wing, new THREE.Vector3(side * .43, 1.18, .09), new THREE.Vector3(side * 1.24, 1.04, .09), .036, darkSteel);
  }
  const cyber = [cyberBody, cyberHead, cyberArm]; cyber.forEach(group => { group.visible = false; });
  const warrior = createWarrior(gradient), partner = new THREE.Group(); partner.add(root, warrior.root);
  armor.visible = stripes.visible = false;
  return { root: partner, dinosaur: root, head, tail, arms, eyes, jaw, armor, stripes, skin, cyber, wings, warrior };
}
