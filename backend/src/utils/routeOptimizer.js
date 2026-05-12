/**
 * VRP Optimizer
 * Phase 1 (algorithm="nn2opt"):  Nearest Neighbor + 2-opt  [baseline]
 * Phase 2 (algorithm="lns-sa"):  Furthest Seed + Cheapest Insertion
 *                                + Or-opt(1,2,3) + Relocate + Swap
 *                                + Shaw Removal / Greedy Reinsertion (LNS)
 *                                + Simulated Annealing acceptance
 *
 * Pure Node.js — no external dependencies.
 */

/* ═══════════════════════════════════════════
   GEOMETRY
═══════════════════════════════════════════ */

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function buildDistMatrix(points) {
  const n = points.length;
  const d = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const v = haversine(points[i].lat, points[i].lng, points[j].lat, points[j].lng);
      d[i][j] = v; d[j][i] = v;
    }
  }
  return d;
}

function minutesToHHMM(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* ═══════════════════════════════════════════
   ROUTE COST HELPERS
═══════════════════════════════════════════ */

function routeDist(dist, route) {
  if (!route.length) return 0;
  let d = dist[0][route[0]];
  for (let i = 0; i < route.length - 1; i++) d += dist[route[i]][route[i + 1]];
  d += dist[route[route.length - 1]][0];
  return d;
}

function totalCost(dist, routesNodes) {
  return routesNodes.reduce((s, r) => s + routeDist(dist, r), 0);
}

function copySol(routesNodes, loads) {
  return {
    routesNodes: routesNodes.map((r) => [...r]),
    loads: loads.map((l) => ({ ...l }))
  };
}

/* ═══════════════════════════════════════════
   COMPATIBILITY HELPERS — capacity + capability + handling-class incompat.
   Each vehicle accumulates a "meta" of handling classes carried so far so the
   solver never lets cargo-incompatible stops share the same vehicle.
═══════════════════════════════════════════ */

function makeRouteMeta(vehicles) {
  return vehicles.map(() => ({ classes: new Set(), incompat: new Set() }));
}

function vehicleCapacityOk(vehicle, load, stop) {
  if (vehicle.maxWeight > 0 && load.weight + stop.weight > vehicle.maxWeight) return false;
  if (vehicle.maxVolume > 0 && load.vol + stop.volume > vehicle.maxVolume) return false;
  return true;
}

function vehicleCanTakeStop(vehicle, load, stop, meta) {
  if (!vehicleCapacityOk(vehicle, load, stop)) return false;
  /* required capability check (e.g. REFRIGERATED, HAZMAT) */
  const caps = vehicle.capabilities ?? [];
  for (const need of (stop.requiredCapabilities ?? [])) {
    if (!caps.includes(need)) return false;
  }
  /* handling-class incompat: don't mix conflicting cargo on same vehicle */
  for (const cls of (stop.handlingClasses ?? [])) {
    if (meta.incompat.has(cls)) return false;
  }
  for (const cls of (stop.incompatibleClasses ?? [])) {
    if (meta.classes.has(cls)) return false;
  }
  return true;
}

function recordStopOnVehicle(load, stop, meta) {
  load.weight += stop.weight;
  load.vol    += stop.volume;
  (stop.handlingClasses     ?? []).forEach((c) => meta.classes.add(c));
  (stop.incompatibleClasses ?? []).forEach((c) => meta.incompat.add(c));
}

/** Recompute compat meta for one route from its current node list — used by
 *  local-search moves that don't track meta incrementally. */
function metaForRoute(routeNodes, stops) {
  const m = { classes: new Set(), incompat: new Set() };
  for (const ni of routeNodes) {
    const s = stops[ni - 1];
    (s.handlingClasses     ?? []).forEach((c) => m.classes.add(c));
    (s.incompatibleClasses ?? []).forEach((c) => m.incompat.add(c));
  }
  return m;
}

/** Can we place stop[stopIdx-1] onto route v (given current loads + nodes)?
 *  Checks capacity + required capabilities + handling-class compat. */
function canPlaceStopOnRoute(vehicles, vIdx, loads, routesNodes, stops, stopIdx) {
  const v = vehicles[vIdx];
  const stop = stops[stopIdx - 1];
  if (!vehicleCapacityOk(v, loads[vIdx], stop)) return false;
  const caps = v.capabilities ?? [];
  for (const need of (stop.requiredCapabilities ?? [])) {
    if (!caps.includes(need)) return false;
  }
  const meta = metaForRoute(routesNodes[vIdx], stops);
  for (const cls of (stop.handlingClasses ?? [])) {
    if (meta.incompat.has(cls)) return false;
  }
  for (const cls of (stop.incompatibleClasses ?? [])) {
    if (meta.classes.has(cls)) return false;
  }
  return true;
}

/** Best-fit decreasing: among feasible vehicles, prefer the one whose remaining
 *  weight slack after placing this stop is smallest — packs heavy loads onto
 *  appropriate trucks so small ones don't waste capacity. */
function pickBestFitVehicle(vehicles, loads, metas, stop) {
  let best = -1, bestSlack = Infinity;
  for (let v = 0; v < vehicles.length; v++) {
    if (!vehicleCanTakeStop(vehicles[v], loads[v], stop, metas[v])) continue;
    const slack = (vehicles[v].maxWeight > 0)
      ? (vehicles[v].maxWeight - loads[v].weight - stop.weight)
      : 0;
    if (slack < bestSlack) { bestSlack = slack; best = v; }
  }
  return best;
}

/* ═══════════════════════════════════════════
   PHASE 1 — Nearest Neighbor (construction)
═══════════════════════════════════════════ */

function nearestNeighborConstruct(dist, stops, vehicles) {
  const n = stops.length;
  const sorted = Array.from({ length: n }, (_, i) => i + 1)
    .sort((a, b) => dist[0][b] - dist[0][a]); // furthest first

  const routesNodes = vehicles.map(() => []);
  const loads = vehicles.map(() => ({ weight: 0, vol: 0 }));
  const metas = makeRouteMeta(vehicles);
  const assigned = new Uint8Array(n + 1);

  for (const seed of sorted) {
    if (assigned[seed]) continue;
    const stop = stops[seed - 1];
    const v = pickBestFitVehicle(vehicles, loads, metas, stop);
    if (v >= 0) {
      routesNodes[v].push(seed);
      recordStopOnVehicle(loads[v], stop, metas[v]);
      assigned[seed] = 1;
    } else {
      /* No compatible vehicle — keep unassigned (caller logs as skipped). */
      assigned[seed] = 1;
    }
  }

  return { routesNodes, loads, metas };
}

/* ═══════════════════════════════════════════
   PHASE 2 — Cheapest Insertion (construction)
═══════════════════════════════════════════ */

function cheapestInsertionConstruct(dist, stops, vehicles) {
  const n = stops.length;
  const routesNodes = vehicles.map(() => []);
  const loads = vehicles.map(() => ({ weight: 0, vol: 0 }));
  const metas = makeRouteMeta(vehicles);
  const assigned = new Uint8Array(n + 1);
  let unassigned = n;

  /* Seed each vehicle: walk furthest-remaining stops, assign to the first
     vehicle that's compatible (capacity + capability + class). */
  const byDist = Array.from({ length: n }, (_, i) => i + 1).sort((a, b) => dist[0][b] - dist[0][a]);
  for (let v = 0; v < vehicles.length && byDist.length; v++) {
    for (let k = 0; k < byDist.length; k++) {
      const seed = byDist[k];
      if (assigned[seed]) continue;
      const stop = stops[seed - 1];
      if (!vehicleCanTakeStop(vehicles[v], loads[v], stop, metas[v])) continue;
      routesNodes[v].push(seed);
      recordStopOnVehicle(loads[v], stop, metas[v]);
      assigned[seed] = 1;
      unassigned--;
      byDist.splice(k, 1);
      break;
    }
  }

  while (unassigned > 0) {
    let bestDelta = Infinity, bestNode = -1, bestRoute = -1, bestPos = -1;

    for (let ni = 1; ni <= n; ni++) {
      if (assigned[ni]) continue;
      const stop = stops[ni - 1];

      for (let r = 0; r < vehicles.length; r++) {
        if (!vehicleCanTakeStop(vehicles[r], loads[r], stop, metas[r])) continue;

        for (let pos = 0; pos <= routesNodes[r].length; pos++) {
          const prev = pos === 0 ? 0 : routesNodes[r][pos - 1];
          const next = pos === routesNodes[r].length ? 0 : routesNodes[r][pos];
          const delta = dist[prev][ni] + dist[ni][next] - dist[prev][next];
          if (delta < bestDelta) { bestDelta = delta; bestNode = ni; bestRoute = r; bestPos = pos; }
        }
      }
    }

    if (bestNode !== -1) {
      routesNodes[bestRoute].splice(bestPos, 0, bestNode);
      recordStopOnVehicle(loads[bestRoute], stops[bestNode - 1], metas[bestRoute]);
      assigned[bestNode] = 1;
      unassigned--;
    } else {
      /* No feasible vehicle for any remaining stop — leave them unassigned;
         callers can log them as skipped. */
      for (let k = 1; k <= n; k++) if (!assigned[k]) { assigned[k] = 1; unassigned--; }
    }
  }

  return { routesNodes, loads, metas };
}

/* ═══════════════════════════════════════════
   INTRA-ROUTE: 2-opt
═══════════════════════════════════════════ */

function twoOpt(dist, route) {
  if (route.length < 3) return route;
  let best = route.slice();
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 2; j < best.length; j++) {
        // Delta check without full re-evaluation
        const a = i === 0 ? 0 : best[i - 1], b = best[i];
        const c = best[j], d = j === best.length - 1 ? 0 : best[j + 1];
        const delta = dist[a][c] + dist[b][d] - dist[a][b] - dist[c][d];
        if (delta < -0.001) {
          /* reverse segment [i..j] in place */
          let l = i, r = j;
          while (l < r) { [best[l], best[r]] = [best[r], best[l]]; l++; r--; }
          improved = true;
        }
      }
    }
  }
  return best;
}

/* ═══════════════════════════════════════════
   INTRA-ROUTE: Or-opt (move segment of segLen)
═══════════════════════════════════════════ */

function orOpt(dist, route, segLen) {
  if (route.length <= segLen) return route;
  let best = route.slice();
  let improved = true;

  while (improved) {
    improved = false;
    for (let i = 0; i <= best.length - segLen; i++) {
      const seg = best.slice(i, i + segLen);
      const without = best.slice(0, i).concat(best.slice(i + segLen));
      if (!without.length) continue;

      /* cost of removing segment from position i */
      const beforeSeg = i === 0 ? 0 : best[i - 1];
      const afterSeg  = i + segLen >= best.length ? 0 : best[i + segLen];
      const removeSaving = dist[beforeSeg][best[i]] + dist[best[i + segLen - 1]][afterSeg] - dist[beforeSeg][afterSeg];

      for (let pos = 0; pos <= without.length; pos++) {
        if (pos === i) continue; // same position — no change
        const prev = pos === 0 ? 0 : without[pos - 1];
        const next = pos === without.length ? 0 : without[pos];
        const insertCost = dist[prev][seg[0]] + dist[seg[segLen - 1]][next] - dist[prev][next];
        if (removeSaving - insertCost > 0.001) {
          best = without.slice(0, pos).concat(seg, without.slice(pos));
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }
  return best;
}

/* ═══════════════════════════════════════════
   INTER-ROUTE: Relocate (1 stop A→B)
═══════════════════════════════════════════ */

function tryRelocate(dist, routesNodes, loads, stops, vehicles) {
  let improved = true;
  while (improved) {
    improved = false;
    outer:
    for (let ra = 0; ra < routesNodes.length; ra++) {
      for (let i = 0; i < routesNodes[ra].length; i++) {
        const node = routesNodes[ra][i];
        const stop = stops[node - 1];
        const prevA = i === 0 ? 0 : routesNodes[ra][i - 1];
        const nextA = i === routesNodes[ra].length - 1 ? 0 : routesNodes[ra][i + 1];
        const removeSaving = dist[prevA][node] + dist[node][nextA] - dist[prevA][nextA];

        for (let rb = 0; rb < routesNodes.length; rb++) {
          if (ra === rb) continue;
          if (!canPlaceStopOnRoute(vehicles, rb, loads, routesNodes, stops, node)) continue;

          for (let pos = 0; pos <= routesNodes[rb].length; pos++) {
            const prev = pos === 0 ? 0 : routesNodes[rb][pos - 1];
            const next = pos === routesNodes[rb].length ? 0 : routesNodes[rb][pos];
            const insertCost = dist[prev][node] + dist[node][next] - dist[prev][next];
            if (removeSaving - insertCost > 0.001) {
              routesNodes[ra].splice(i, 1);
              routesNodes[rb].splice(pos, 0, node);
              loads[ra].weight -= stop.weight; loads[ra].vol -= stop.volume;
              loads[rb].weight += stop.weight; loads[rb].vol += stop.volume;
              improved = true;
              break outer;
            }
          }
        }
      }
    }
  }
}

/* ═══════════════════════════════════════════
   INTER-ROUTE: Swap (exchange 1 stop each)
═══════════════════════════════════════════ */

function trySwap(dist, routesNodes, loads, stops, vehicles) {
  let improved = true;
  while (improved) {
    improved = false;
    outer:
    for (let ra = 0; ra < routesNodes.length - 1; ra++) {
      for (let i = 0; i < routesNodes[ra].length; i++) {
        const na = routesNodes[ra][i];
        const stopA = stops[na - 1];
        const prevA = i === 0 ? 0 : routesNodes[ra][i - 1];
        const nextA = i === routesNodes[ra].length - 1 ? 0 : routesNodes[ra][i + 1];

        for (let rb = ra + 1; rb < routesNodes.length; rb++) {
          for (let j = 0; j < routesNodes[rb].length; j++) {
            const nb = routesNodes[rb][j];
            const stopB = stops[nb - 1];

            const newWa = loads[ra].weight - stopA.weight + stopB.weight;
            const newWb = loads[rb].weight - stopB.weight + stopA.weight;
            if (vehicles[ra].maxWeight > 0 && newWa > vehicles[ra].maxWeight) continue;
            if (vehicles[rb].maxWeight > 0 && newWb > vehicles[rb].maxWeight) continue;
            /* Capability + handling-class compat: simulate the swap before
               accepting it. Skip if either vehicle would lack a required
               capability or end up mixing incompat classes. */
            const vehA = vehicles[ra], vehB = vehicles[rb];
            const capsA = vehA.capabilities ?? [];
            const capsB = vehB.capabilities ?? [];
            const reqA = stopA.requiredCapabilities ?? [];
            const reqB = stopB.requiredCapabilities ?? [];
            if (reqB.some((c) => !capsA.includes(c))) continue;
            if (reqA.some((c) => !capsB.includes(c))) continue;
            const otherA = routesNodes[ra].filter((x) => x !== na);
            const otherB = routesNodes[rb].filter((x) => x !== nb);
            const metaA = metaForRoute(otherA, stops);
            const metaB = metaForRoute(otherB, stops);
            const incomp = (stop, meta) =>
              (stop.handlingClasses     ?? []).some((c) => meta.incompat.has(c)) ||
              (stop.incompatibleClasses ?? []).some((c) => meta.classes.has(c));
            if (incomp(stopB, metaA) || incomp(stopA, metaB)) continue;

            const prevB = j === 0 ? 0 : routesNodes[rb][j - 1];
            const nextB = j === routesNodes[rb].length - 1 ? 0 : routesNodes[rb][j + 1];

            const oldCost = dist[prevA][na] + dist[na][nextA] + dist[prevB][nb] + dist[nb][nextB];
            const newCost = dist[prevA][nb] + dist[nb][nextA] + dist[prevB][na] + dist[na][nextB];
            if (newCost < oldCost - 0.001) {
              routesNodes[ra][i] = nb; routesNodes[rb][j] = na;
              loads[ra].weight += stopB.weight - stopA.weight;
              loads[ra].vol   += stopB.volume - stopA.volume;
              loads[rb].weight += stopA.weight - stopB.weight;
              loads[rb].vol   += stopA.volume - stopB.volume;
              improved = true;
              break outer;
            }
          }
        }
      }
    }
  }
}

/* ═══════════════════════════════════════════
   LNS DESTROY: Shaw Removal
   Remove N related (geographically close) stops
═══════════════════════════════════════════ */

function shawRemoval(dist, routesNodes, loads, stops, N) {
  const allStops = [];
  for (let r = 0; r < routesNodes.length; r++) {
    for (const node of routesNodes[r]) allStops.push({ node, routeIdx: r });
  }
  if (allStops.length === 0) return [];

  const pivotItem = allStops[Math.floor(Math.random() * allStops.length)];
  const pivot = pivotItem.node;

  /* Sort by distance from pivot (relatedness) */
  const sorted = allStops
    .filter((s) => s !== pivotItem)
    .sort((a, b) => dist[pivot][a.node] - dist[pivot][b.node]);

  const toRemove = [pivotItem, ...sorted.slice(0, N - 1)];
  const removed = [];

  for (const { node, routeIdx } of toRemove) {
    const pos = routesNodes[routeIdx].indexOf(node);
    if (pos === -1) continue;
    routesNodes[routeIdx].splice(pos, 1);
    loads[routeIdx].weight -= stops[node - 1].weight;
    loads[routeIdx].vol    -= stops[node - 1].volume;
    removed.push(node);
  }
  return removed;
}

/* ═══════════════════════════════════════════
   LNS REPAIR: Greedy Reinsertion
═══════════════════════════════════════════ */

function greedyReinsert(dist, routesNodes, loads, stops, vehicles, removed) {
  const pool = [...removed];

  while (pool.length) {
    let bestDelta = Infinity, bestNode = -1, bestRoute = -1, bestPos = -1, bestPoolIdx = -1;

    for (let k = 0; k < pool.length; k++) {
      const node = pool[k];
      for (let r = 0; r < routesNodes.length; r++) {
        if (!canPlaceStopOnRoute(vehicles, r, loads, routesNodes, stops, node)) continue;
        for (let pos = 0; pos <= routesNodes[r].length; pos++) {
          const prev = pos === 0 ? 0 : routesNodes[r][pos - 1];
          const next = pos === routesNodes[r].length ? 0 : routesNodes[r][pos];
          const delta = dist[prev][node] + dist[node][next] - dist[prev][next];
          if (delta < bestDelta) { bestDelta = delta; bestNode = node; bestRoute = r; bestPos = pos; bestPoolIdx = k; }
        }
      }
    }

    if (bestNode === -1) {
      /* force into least-loaded vehicle */
      const node = pool[0];
      const minR = loads.reduce((mi, l, i) => (l.weight < loads[mi].weight ? i : mi), 0);
      routesNodes[minR].push(node);
      loads[minR].weight += stops[node - 1].weight;
      loads[minR].vol    += stops[node - 1].volume;
      pool.splice(0, 1);
    } else {
      routesNodes[bestRoute].splice(bestPos, 0, bestNode);
      loads[bestRoute].weight += stops[bestNode - 1].weight;
      loads[bestRoute].vol    += stops[bestNode - 1].volume;
      pool.splice(bestPoolIdx, 1);
    }
  }
}

/* ═══════════════════════════════════════════
   LOCAL SEARCH PASS (intra all routes)
═══════════════════════════════════════════ */

function localSearchAll(dist, routesNodes) {
  for (let r = 0; r < routesNodes.length; r++) {
    if (routesNodes[r].length < 2) continue;
    routesNodes[r] = twoOpt(dist, routesNodes[r]);
    routesNodes[r] = orOpt(dist, routesNodes[r], 1);
    if (routesNodes[r].length >= 3) routesNodes[r] = orOpt(dist, routesNodes[r], 2);
    if (routesNodes[r].length >= 4) routesNodes[r] = orOpt(dist, routesNodes[r], 3);
  }
}

/* ═══════════════════════════════════════════
   LNS + SA MAIN LOOP
═══════════════════════════════════════════ */

function lnsSa(dist, initRoutes, initLoads, stops, vehicles) {
  const N = stops.length;
  const removeMin = Math.max(2, Math.floor(N * 0.05));
  const removeMax = Math.max(removeMin, Math.min(Math.floor(N * 0.25), 10));
  const iterations = Math.min(800, Math.max(150, N * 12));
  const T0 = 2.0;   // km — initial temperature
  const cool = Math.exp(Math.log(0.01) / iterations); // cool to 1% of T0

  let { routesNodes: cur, loads: curL } = copySol(initRoutes, initLoads);
  let curCost = totalCost(dist, cur);
  let { routesNodes: best, loads: bestL } = copySol(cur, curL);
  let bestCost = curCost;
  let T = T0;

  for (let iter = 0; iter < iterations; iter++) {
    const { routesNodes: cand, loads: candL } = copySol(cur, curL);

    const nRemove = removeMin + Math.floor(Math.random() * (removeMax - removeMin + 1));
    const removed = shawRemoval(dist, cand, candL, stops, nRemove);
    greedyReinsert(dist, cand, candL, stops, vehicles, removed);

    /* quick intra improvement on touched routes */
    for (let r = 0; r < cand.length; r++) {
      if (cand[r].length >= 2) cand[r] = twoOpt(dist, cand[r]);
      if (cand[r].length >= 2) cand[r] = orOpt(dist, cand[r], 1);
    }

    const candCost = totalCost(dist, cand);
    const delta = candCost - curCost;

    if (delta < 0 || Math.random() < Math.exp(-delta / T)) {
      cur = cand; curL = candL; curCost = candCost;
      if (curCost < bestCost) {
        ({ routesNodes: best, loads: bestL } = copySol(cur, curL));
        bestCost = curCost;
      }
    }
    T *= cool;
  }

  /* final thorough local search on best */
  localSearchAll(dist, best);
  tryRelocate(dist, best, bestL, stops, vehicles);
  trySwap(dist, best, bestL, stops, vehicles);
  localSearchAll(dist, best);

  return { routesNodes: best, loads: bestL };
}

/* ═══════════════════════════════════════════
   BUILD OUTPUT (shared by both phases)
═══════════════════════════════════════════ */

function buildOutput(dist, routesNodes, loads, stops, vehicles, avgSpeedKmh, departMinutes) {
  const result = [];
  for (let v = 0; v < vehicles.length; v++) {
    const route = routesNodes[v];
    if (!route?.length) continue;

    let time = departMinutes, prev = 0;
    const builtStops = route.map((nodeIdx, si) => {
      const stop = stops[nodeIdx - 1];
      time += (dist[prev][nodeIdx] / avgSpeedKmh) * 60;
      const arrival = minutesToHHMM(time);
      time += stop.serviceTime ?? 15;
      prev = nodeIdx;
      return { ...stop, stopIndex: si + 1, plannedArrival: arrival };
    });

    result.push({
      vehicleID:     vehicles[v].id,
      vehicleCode:   vehicles[v].code,
      stops:         builtStops,
      totalDistance: Math.round(routeDist(dist, route) * 10) / 10,
      totalWeight:   Math.round(loads[v].weight * 100) / 100,
      totalVolume:   Math.round(loads[v].vol * 1000) / 1000
    });
  }
  return result;
}

/* ═══════════════════════════════════════════
   PUBLIC API
═══════════════════════════════════════════ */

/**
 * @param {object} opts
 * @param {{lat,lng}} opts.depot
 * @param {Array<{id,code,maxWeight,maxVolume}>} opts.vehicles
 * @param {Array<{customerCode,customerName,address,lat,lng,serviceTime,weight,volume,orders}>} opts.stops
 * @param {"lns-sa"|"nn2opt"} [opts.algorithm="lns-sa"]
 * @param {number} [opts.avgSpeedKmh=40]
 * @param {number} [opts.departMinutes=480]  08:00 = 480
 */
export function optimizeRoutes({
  depot, vehicles, stops,
  algorithm = "lns-sa",
  avgSpeedKmh = 40,
  departMinutes = 480
}) {
  if (!stops.length || !vehicles.length) return [];

  const points = [depot, ...stops];
  const dist = buildDistMatrix(points);

  let routesNodes, loads;

  if (algorithm === "nn2opt") {
    /* Phase 1 — fast baseline */
    ({ routesNodes, loads } = nearestNeighborConstruct(dist, stops, vehicles));
    for (let v = 0; v < vehicles.length; v++) {
      if (routesNodes[v].length >= 2) routesNodes[v] = twoOpt(dist, routesNodes[v]);
    }
  } else {
    /* Phase 2 — LNS + SA */
    ({ routesNodes, loads } = cheapestInsertionConstruct(dist, stops, vehicles));
    localSearchAll(dist, routesNodes);
    tryRelocate(dist, routesNodes, loads, stops, vehicles);
    trySwap(dist, routesNodes, loads, stops, vehicles);
    ({ routesNodes, loads } = lnsSa(dist, routesNodes, loads, stops, vehicles));
  }

  return buildOutput(dist, routesNodes, loads, stops, vehicles, avgSpeedKmh, departMinutes);
}
