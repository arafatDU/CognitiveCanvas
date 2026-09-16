import { Delaunay } from 'd3-delaunay';

export interface VoronoiSite {
  id: string;
  x: number;
  y: number;
  color: string;
  clusterId?: string;
}

export interface VoronoiCell {
  id: string;
  path: string;
  color: string;
  clusterId?: string;
}

/**
 * Computes Voronoi polygon cells for given canvas sites using Delaunay triangulation.
 * If fewer than 2 sites exist, returns empty array.
 */
export function computeVoronoiCells(
  sites: VoronoiSite[],
  bounds: [number, number, number, number] = [-2000, -2000, 4000, 4000]
): VoronoiCell[] {
  if (sites.length < 2) return [];

  // Delaunay expects array of [x, y] coordinates typed as [number, number][]
  const points: [number, number][] = sites.map((s) => [s.x, s.y]);
  const delaunay = Delaunay.from(points);
  const voronoi = delaunay.voronoi(bounds);

  return sites.map((site, index) => {
    const cellPolygon = voronoi.cellPolygon(index);
    if (!cellPolygon || cellPolygon.length === 0) {
      return { id: site.id, path: '', color: site.color, clusterId: site.clusterId };
    }

    // Convert polygon points to SVG path 'M x y L x y ... Z'
    const path = `M ${cellPolygon.map((pt) => pt.join(',')).join(' L ')} Z`;
    return {
      id: site.id,
      path,
      color: site.color,
      clusterId: site.clusterId,
    };
  });
}
