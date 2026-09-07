import { CriacaoDeCarreira } from "./features/criacao-de-carreira/CriacaoDeCarreira.js";

function App() {
  return <CriacaoDeCarreira onCarreiraCriada={(estado) => console.log("Carreira criada:", estado)} />;
}

export default App;
