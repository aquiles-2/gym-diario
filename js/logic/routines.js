// Rutinas = plantillas. Iniciar una rutina COPIA sus ejercicios a un borrador: la rutina original nunca se modifica.
export const routineToWorkout = (r, date, uid) => { const now = Date.now();
  return { id: uid(), date, name: r.name, status: 'draft', notes: '', routineId: r.id, createdAt: now, updatedAt: now,
    exercises: r.exercises.map(e => ({ id: uid(), exerciseId: e.exerciseId, name: e.name, sets: Array.from({ length: e.sets }, () => ({ kg: null, reps: null })) })) }; };
export const duplicateRoutine = (r, uid) => { const now = Date.now();
  return { id: uid(), name: `${r.name} (copia)`, createdAt: now, updatedAt: now, exercises: r.exercises.map(e => ({ ...e })) }; };
export function moveItem(a, i, d) { const j = i + d; if (j < 0 || j >= a.length) return a; const c = [...a]; [c[i], c[j]] = [c[j], c[i]]; return c; }
