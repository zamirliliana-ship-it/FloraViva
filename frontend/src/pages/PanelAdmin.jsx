import { useCallback, useEffect, useState } from "react";
import { Leaf, LogOut, MessageSquare, RefreshCw, Scale, ShieldCheck, Sprout, Trash2, Users } from "lucide-react";
import { eliminarPublicacion, listarForo, obtenerMetricas } from "../services/adminPanel";
import "./PanelAdmin.css";

const numero = (valor) => (valor === null || valor === undefined ? "—" : Number(valor).toLocaleString("es-CO"));

function formatearFecha(texto) {
  if (!texto) return "";
  const fecha = new Date(texto);
  return Number.isNaN(fecha.getTime()) ? "" : fecha.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

function Tarjeta({ icono: Icono, titulo, valor, pie }) {
  return (
    <article className="panel-tarjeta">
      <div className="panel-tarjeta-icono"><Icono size={19} /></div>
      <span className="panel-tarjeta-titulo">{titulo}</span>
      <strong className="panel-tarjeta-valor">{valor}</strong>
      {pie && <small className="panel-tarjeta-pie">{pie}</small>}
    </article>
  );
}

export default function PanelAdmin({ token, email, onSalir }) {
  const [pestana, setPestana] = useState("resumen");
  const [metricas, setMetricas] = useState(null);
  const [publicaciones, setPublicaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [eliminando, setEliminando] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const [datos, foro] = await Promise.all([obtenerMetricas(token), listarForo(token)]);
      setMetricas(datos);
      setPublicaciones(foro.publicaciones || []);
    } catch (fallo) {
      setError(fallo?.message || "No se pudieron cargar los datos del panel.");
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  async function borrar(publicacion) {
    if (!window.confirm(`¿Eliminar la publicación "${publicacion.titulo}"? Esta acción no se puede deshacer.`)) return;
    setEliminando(publicacion.id);
    setError("");
    try {
      await eliminarPublicacion(token, publicacion.id);
      setPublicaciones((lista) => lista.filter((p) => p.id !== publicacion.id));
      setMetricas((m) => (m && typeof m.publicaciones_foro === "number" ? { ...m, publicaciones_foro: m.publicaciones_foro - 1 } : m));
    } catch (fallo) {
      setError(fallo?.message || "No se pudo eliminar la publicación.");
    } finally {
      setEliminando("");
    }
  }

  const usuarios = metricas?.usuarios;

  return (
    <main className="panel-admin">
      <header className="panel-cabecera">
        <div className="panel-marca">
          <div className="panel-marca-icono"><Sprout size={22} /></div>
          <div>
            <h1>Panel de administración</h1>
            <p><ShieldCheck size={13} /> {email || "Administrador"} · sesión temporal</p>
          </div>
        </div>
        <div className="panel-acciones">
          <button type="button" className="panel-boton-suave" onClick={cargar} disabled={cargando}>
            <RefreshCw size={15} className={cargando ? "panel-girar" : ""} /> Actualizar
          </button>
          <button type="button" className="panel-boton-oscuro" onClick={onSalir}><LogOut size={15} /> Salir</button>
        </div>
      </header>

      <nav className="panel-pestanas" aria-label="Secciones del panel">
        <button type="button" className={pestana === "resumen" ? "activa" : ""} onClick={() => setPestana("resumen")}>Resumen</button>
        <button type="button" className={pestana === "foro" ? "activa" : ""} onClick={() => setPestana("foro")}>
          Moderación del foro{publicaciones.length ? ` (${publicaciones.length})` : ""}
        </button>
      </nav>

      {error && <p className="panel-error" role="alert">{error}</p>}
      {cargando && !metricas && <p className="panel-cargando">Cargando datos… si el servidor estaba dormido puede tardar hasta un minuto.</p>}

      {pestana === "resumen" && metricas && (
        <>
          <section className="panel-rejilla">
            <Tarjeta icono={Users} titulo="Usuarios" valor={numero(usuarios?.total)}
              pie={usuarios ? `${numero(usuarios.confirmados)} confirmados · ${numero(usuarios.nuevos_7_dias)} nuevos en 7 días` : "No disponible"} />
            <Tarjeta icono={Sprout} titulo="Cultivos" valor={numero(metricas.cultivos)} pie={`${numero(metricas.plantas)} plantas registradas`} />
            <Tarjeta icono={Scale} titulo="Frutos registrados" valor={numero(metricas.frutos_registrados)} pie={`${numero(metricas.registros_produccion)} registros de cosecha`} />
            <Tarjeta icono={Leaf} titulo="Escaneos botánicos" valor={numero(metricas.escaneos)} pie={`${numero(metricas.recordatorios)} recordatorios creados`} />
            <Tarjeta icono={MessageSquare} titulo="Publicaciones del foro" valor={numero(metricas.publicaciones_foro)} pie={`${numero(metricas.observaciones)} observaciones de cultivo`} />
          </section>

          <section className="panel-dos-columnas">
            <article className="panel-caja">
              <h2>Cultivos más frecuentes</h2>
              {metricas.cultivos_frecuentes?.length ? (
                <ul className="panel-lista">
                  {metricas.cultivos_frecuentes.map((c) => <li key={c.nombre}><span>{c.nombre}</span><strong>{numero(c.total)}</strong></li>)}
                </ul>
              ) : <p className="panel-vacio">Aún no hay cultivos registrados.</p>}
            </article>
            <article className="panel-caja">
              <h2>Foro por categoría</h2>
              {metricas.foro_por_categoria?.length ? (
                <ul className="panel-lista">
                  {metricas.foro_por_categoria.map((c) => <li key={c.categoria}><span>{c.categoria}</span><strong>{numero(c.total)}</strong></li>)}
                </ul>
              ) : <p className="panel-vacio">Aún no hay publicaciones.</p>}
            </article>
          </section>
          <p className="panel-nota">Cifras agregadas de toda la plataforma. Por privacidad, el panel no muestra correos ni los datos individuales de cada usuario. Actualizado: {formatearFecha(metricas.generado_en)}.</p>
        </>
      )}

      {pestana === "foro" && (
        <section className="panel-caja panel-foro">
          <h2>Últimas publicaciones</h2>
          {!cargando && publicaciones.length === 0 && <p className="panel-vacio">No hay publicaciones para moderar.</p>}
          <ul className="panel-publicaciones">
            {publicaciones.map((p) => (
              <li key={p.id}>
                <div className="panel-publicacion-texto">
                  <div className="panel-publicacion-meta">
                    {p.categoria && <span className="panel-etiqueta">{p.categoria}</span>}
                    <span>{p.autor_nombre || "Usuario"}</span>
                    <span>·</span>
                    <span>{formatearFecha(p.created_at)}</span>
                  </div>
                  <h3>{p.titulo}</h3>
                  <p>{p.contenido}</p>
                </div>
                <button type="button" className="panel-boton-peligro" onClick={() => borrar(p)} disabled={eliminando === p.id} aria-label={`Eliminar ${p.titulo}`}>
                  <Trash2 size={15} /> {eliminando === p.id ? "Eliminando…" : "Eliminar"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
