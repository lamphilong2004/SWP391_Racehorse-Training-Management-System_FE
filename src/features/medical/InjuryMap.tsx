import { useState } from 'react';
import { Button, Card, EmptyState, KeyValue } from '../../design-system';
import type { Injury } from './models';
import body from './assets/body.svg';
import head from './assets/head.svg';
import halo from './assets/halo.svg';
import marker from './assets/marker.svg';

import { BODY_REGIONS } from './bodyRegions';
// Schematic side-view positions; never converted to backend 3D coordinates.
const points: Record<string, [number, number]> = {
  Head: [494, 146], Neck: [463, 175], Shoulder: [440, 207], 'Left Forelimb': [436, 326],
  'Right Forelimb': [476, 326], Back: [327, 173], 'Left Hindlimb': [216, 326], 'Right Hindlimb': [256, 326],
};
export function InjuryMap({ injuries }: { injuries: Injury[] }) {
  const [selected, setSelected] = useState(injuries[0]?.bodyRegion ?? 'Left Forelimb');
  const injury = injuries.find((item) => item.bodyRegion === selected);
  const point = points[selected];
  return <div className="medical-grid">
    <div className="medical-stack">
      <p className="text-caption">2D schematic fallback. The interactive 3D model is unavailable.</p>
      <div className="medical-map" role="img" aria-label={'Side-view horse injury schematic: ' + selected}>
        <div className="medical-map-canvas">
          <img src={body} className="medical-map-body" alt="" width={300} height={90} />
          <img src={head} className="medical-map-head" alt="" width={70} height={55} />
          {[209, 249, 429, 469].map((left) => <span key={left} className="medical-map-leg" style={{ left }} />)}
          {injury && point && <><img src={halo} alt="" width={26} height={26} className="medical-map-marker" style={{ left: point[0] - 13, top: point[1] - 13 }} /><img src={marker} alt="" width={14} height={14} className="medical-map-marker" style={{ left: point[0] - 7, top: point[1] - 7 }} /></>}
        </div>
      </div>
    </div>
    <div className="medical-stack"><Card title="Body Region"><div className="medical-region-list">{BODY_REGIONS.map((region) => <Button key={region} variant={selected === region ? 'secondary' : 'tertiary'} aria-pressed={selected === region} onClick={() => setSelected(region)}>{region}</Button>)}</div></Card>
      <Card title="Injury Details">{injury ? <div className="medical-stack"><KeyValue label="Region" value={injury.bodyRegion} /><KeyValue label="Severity" value={injury.severity} /><KeyValue label="Recovery" value={injury.recoveryStatus} />{injury.position3d && <p>Position marker: {injury.position3d}</p>}</div> : <EmptyState title="No injury in this region" />}</Card>
    </div>
  </div>;
}
