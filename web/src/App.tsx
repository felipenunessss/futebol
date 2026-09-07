import { useState } from "react";
import type { EstadoDeCarreira } from "@motor/career/Player.js";
import { CriacaoDeCarreira } from "./features/criacao-de-carreira/CriacaoDeCarreira.js";
import { TelaDeTemporada } from "./features/temporada/TelaDeTemporada.js";

function App() {
  const [estadoInicial, setEstadoInicial] = useState<EstadoDeCarreira>();

  if (!estadoInicial) {
    return <CriacaoDeCarreira onCarreiraCriada={setEstadoInicial} />;
  }

  return <TelaDeTemporada estadoInicial={estadoInicial} />;
}

export default App;
