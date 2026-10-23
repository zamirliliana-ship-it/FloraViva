
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Download,
  Leaf,
  LogOut,
  MessageSquare,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Sprout,
  Trash2,
  Users,
} from "lucide-react";
import {
  eliminarPublicacion,
  listarForo,
  obtenerMetricas,
} from "../services/adminPanel";
import "./PanelAdmin.css";

const numero = (valor) =>
  valor === null || valor === undefined
    ? "—"
    : Number(valor).toLocaleString("es-CO");

function formatearFecha(texto) {
  if (!texto) return "";
  const fecha = new Date(texto);

  return Number.isNaN(fecha.getTime())
    ? ""
    : fecha.toLocaleString("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function escaparCSV(valor) {
  let texto = String(valor ?? "");

  // Evita que Excel interprete el contenido como una fórmula.
  if (/^[\s]*[=+\-@]/.test(texto)) {
    texto = "'" + texto;
  }

  return `"${texto.replace(/"/g, '""')}"`;
}

function descargarCSV(nombre, filas) {
  const contenido = filas
    .map((fila) => fila.map(escaparCSV).join(";"))
    .join("\r\n");

  // El BOM UTF-8 ayuda a Excel a reconocer tildes y ñ.
  const blob = new Blob(["\uFEFF", contenido], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");

  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Tarjeta({ icono: Icono, titulo, valor, pie }) {
  return (
    <article className="panel-tarjeta">
      <div className="panel-tarjeta-icono">
        <Icono size={19} />
      </div>
      <span className="panel-tarjeta-titulo">{titulo}</span>
      <strong className="panel-tarjeta-valor">{valor}</strong>
      {pie && <small className="panel-tarjeta-pie">{pie}</small>}
    </article>
  );
}

function GraficoActividad({ titulo, serie, color }) {
  const disponible = Array.isArray(serie);
  const total = disponible
    ? serie.reduce((suma, punto) => suma + Number(punto.total || 0), 0)
    : null;

  const maximo = disponible
    ? Math.max(1, ...serie.map((punto) => Number(punto.total || 0)))
    : 1;

  return (
    <article className="panel-caja panel-grafico">
      <div className="panel-grafico-cabecera">
        <div>
          <h3>{titulo}</h3>
          <p>Últimos 14 días</p>
        </div>
        <strong className="panel-grafico-total">
          {disponible ? numero(total) : "N/D"}
        </strong>
      </div>

      {!disponible ? (
        <p className="panel-vacio">
          No se pudo obtener la serie diaria. Revisa la tabla y su columna de fecha.
        </p>
      ) : (
        <>
          <div
            className="panel-barras"
            role="group"
            aria-label={`${titulo}: ${numero(total)} en los últimos 14 días`}
          >
            {serie.map((punto) => {
              const valor = Number(punto.total || 0);
              const altura =
                valor === 0 ? 2 : Math.max(5, (valor / maximo) * 100);

              return (
                <div className="panel-barra-columna" key={punto.fecha}>
                  <div className="panel-barra-area">
                    <div
                      className={`panel-barra ${color}`}
                      style={{ height: `${altura}%` }}
                      title={`${punto.fecha}: ${numero(valor)}`}
                      role="img"
                      aria-label={`${punto.fecha}: ${numero(valor)}`}
                    />
                  </div>
                  <span className="panel-barra-fecha">
                    {punto.fecha?.slice(8, 10)}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="panel-grafico-ayuda">
            Pasa el cursor sobre una barra para ver la fecha y la cantidad.
          </p>
        </>
      )}
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
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("todas");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const [datos, foro] = await Promise.all([
        obtenerMetricas(token),
        listarForo(token),
      ]);

      setMetricas(datos);
      setPublicaciones(foro.publicaciones || []);
    } catch (fallo) {
      setError(
        fallo?.message || "No se pudieron cargar los datos del panel."
      );
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function borrar(publicacion) {
    const confirmar = window.confirm(
      `¿Eliminar la publicación "${publicacion.titulo}"? Esta acción no se puede deshacer.`
    );

    if (!confirmar) return;

    setEliminando(publicacion.id);
    setError("");

    try {
      await eliminarPublicacion(token, publicacion.id);

      setPublicaciones((lista) =>
        lista.filter((p) => p.id !== publicacion.id)
      );

      setMetricas((actual) =>
        actual && typeof actual.publicaciones_foro === "number"
          ? {
              ...actual,
              publicaciones_foro: Math.max(
                0,
                actual.publicaciones_foro - 1
              ),
            }
          : actual
      );
    } catch (fallo) {
      setError(fallo?.message || "No se pudo eliminar la publicación.");
    } finally {
      setEliminando("");
    }
  }

  const usuarios = metricas?.usuarios;
  const actividad = metricas?.actividad_14_dias;

  const categorias = useMemo(() => {
    const valores = publicaciones
      .map((p) => (p.categoria || "").trim())
      .filter(Boolean);

    return [...new Set(valores)].sort((a, b) =>
      a.localeCompare(b, "es")
    );
  }, [publicaciones]);

  const publicacionesFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase("es");

    return publicaciones.filter((publicacion) => {
      const coincideCategoria =
        categoria === "todas" || publicacion.categoria === categoria;

      const contenido = [
        publicacion.titulo,
        publicacion.contenido,
        publicacion.autor_nombre,
        publicacion.categoria,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("es");

      return coincideCategoria && (!texto || contenido.includes(texto));
    });
  }, [publicaciones, busqueda, categoria]);

  function exportarResumen() {
    if (!metricas) return;

    const filas = [
      ["FloraViva - Resumen administrativo"],
      ["Generado en", metricas.generado_en || ""],
      [],
      ["Indicador", "Valor"],
      ["Usuarios totales", usuarios?.total ?? ""],
      ["Usuarios confirmados", usuarios?.confirmados ?? ""],
      ["Usuarios sin confirmar", usuarios?.sin_confirmar ?? ""],
      ["Usuarios nuevos en 7 días", usuarios?.nuevos_7_dias ?? ""],
      ["Cultivos", metricas.cultivos ?? ""],
      ["Plantas", metricas.plantas ?? ""],
      ["Frutos registrados", metricas.frutos_registrados ?? ""],
      ["Registros de producción", metricas.registros_produccion ?? ""],
      ["Escaneos totales", metricas.escaneos ?? ""],
      ["Recordatorios", metricas.recordatorios ?? ""],
      ["Publicaciones del foro", metricas.publicaciones_foro ?? ""],
      ["Observaciones de cultivo", metricas.observaciones ?? ""],
      [],
      ["Actividad diaria - últimos 14 días"],
      ["Fecha", "Usuarios nuevos", "Cosechas registradas", "Escaneos"],
    ];

    const serieUsuarios = actividad?.usuarios_nuevos;
    const serieCosechas = actividad?.cosechas_registradas;
    const serieEscaneos = actividad?.escaneos;
    const fechas = actividad?.fechas || [];

    function valorDeSerie(serie, fecha) {
      if (!Array.isArray(serie)) return "No disponible";

      return serie.find((punto) => punto.fecha === fecha)?.total ?? 0;
    }

    for (const fecha of fechas) {
      filas.push([
        fecha,
        valorDeSerie(serieUsuarios, fecha),
        valorDeSerie(serieCosechas, fecha),
        valorDeSerie(serieEscaneos, fecha),
      ]);
    }

    filas.push([], ["Cultivos más frecuentes"], ["Cultivo", "Total"]);

    for (const cultivo of metricas.cultivos_frecuentes || []) {
      filas.push([cultivo.nombre, cultivo.total]);
    }

    filas.push([], ["Foro por categoría"], ["Categoría", "Total"]);

    for (const item of metricas.foro_por_categoria || []) {
      filas.push([item.categoria, item.total]);
    }

    descargarCSV("floraviva_resumen.csv", filas);
  }

  function exportarForo() {
    const filas = [
      [
        "ID",
        "Autor",
        "Categoría",
        "Título",
        "Contenido",
        "Fecha de creación",
      ],
      ...publicacionesFiltradas.map((publicacion) => [
        publicacion.id,
        publicacion.autor_nombre || "Usuario",
        publicacion.categoria || "",
        publicacion.titulo || "",
        publicacion.contenido || "",
        publicacion.created_at || "",
      ]),
    ];

    descargarCSV("floraviva_foro_filtrado.csv", filas);
  }

  return (
    <main className="panel-admin">
      <header className="panel-cabecera">
        <div className="panel-marca">
          <div className="panel-marca-icono">
            <Sprout size={22} />
          </div>
          <div>
            <h1>Panel de administración</h1>
            <p>
              <ShieldCheck size={13} /> {email || "Administrador"} · sesión
              temporal
            </p>
          </div>
        </div>

        <div className="panel-acciones">
          <button
            type="button"
            className="panel-boton-suave"
            onClick={cargar}
            disabled={cargando}
          >
            <RefreshCw
              size={15}
              className={cargando ? "panel-girar" : ""}
            />
            Actualizar
          </button>
          <button
            type="button"
            className="panel-boton-oscuro"
            onClick={onSalir}
          >
            <LogOut size={15} /> Salir
          </button>
        </div>
      </header>

      <nav className="panel-pestanas" aria-label="Secciones del panel">
        <button
          type="button"
          className={pestana === "resumen" ? "activa" : ""}
          onClick={() => setPestana("resumen")}
        >
          Resumen
        </button>
        <button
          type="button"
          className={pestana === "foro" ? "activa" : ""}
          onClick={() => setPestana("foro")}
        >
          Moderación del foro ({publicaciones.length})
        </button>
      </nav>

      {error && (
        <p className="panel-error" role="alert">
          {error}
        </p>
      )}

      {cargando && !metricas && (
        <p className="panel-cargando">
          Cargando datos… si el servidor estaba dormido puede tardar hasta un
          minuto.
        </p>
      )}

      {pestana === "resumen" && metricas && (
        <>
          <div className="panel-exportaciones">
            <div>
              <h2>Resumen de la plataforma</h2>
              <p>Indicadores generales y actividad reciente.</p>
            </div>
            <button
              type="button"
              className="panel-boton-suave"
              onClick={exportarResumen}
            >
              <Download size={16} /> Exportar resumen CSV
            </button>
          </div>

          <section className="panel-rejilla">
            <Tarjeta
              icono={Users}
              titulo="Usuarios"
              valor={numero(usuarios?.total)}
              pie={
                usuarios
                  ? `${numero(usuarios.confirmados)} confirmados · ${numero(usuarios.nuevos_7_dias)} nuevos en 7 días`
                  : "No disponible"
              }
            />
            <Tarjeta
              icono={Sprout}
              titulo="Cultivos"
              valor={numero(metricas.cultivos)}
              pie={`${numero(metricas.plantas)} plantas registradas`}
            />
            <Tarjeta
              icono={Scale}
              titulo="Frutos registrados"
              valor={numero(metricas.frutos_registrados)}
              pie={`${numero(metricas.registros_produccion)} registros de cosecha`}
            />
            <Tarjeta
              icono={Leaf}
              titulo="Escaneos botánicos"
              valor={numero(metricas.escaneos)}
              pie={`${numero(metricas.recordatorios)} recordatorios creados`}
            />
            <Tarjeta
              icono={MessageSquare}
              titulo="Publicaciones del foro"
              valor={numero(metricas.publicaciones_foro)}
              pie={`${numero(metricas.observaciones)} observaciones de cultivo`}
            />
          </section>

          <section className="panel-actividad">
            <div className="panel-seccion-titulo">
              <BarChart3 size={19} />
              <div>
                <h2>Actividad reciente</h2>
                <p>Comparación diaria de los últimos 14 días.</p>
              </div>
            </div>

            <div className="panel-graficos-grid">
              <GraficoActividad
                titulo="Usuarios nuevos"
                serie={actividad?.usuarios_nuevos}
                color="panel-barra-verde"
              />
              <GraficoActividad
                titulo="Cosechas registradas"
                serie={actividad?.cosechas_registradas}
                color="panel-barra-oliva"
              />
              <GraficoActividad
                titulo="Escaneos botánicos"
                serie={actividad?.escaneos}
                color="panel-barra-azul"
              />
            </div>
          </section>

          <section className="panel-dos-columnas">
            <article className="panel-caja">
              <h2>Cultivos más frecuentes</h2>
              {metricas.cultivos_frecuentes?.length ? (
                <ul className="panel-lista">
                  {metricas.cultivos_frecuentes.map((cultivo) => (
                    <li key={cultivo.nombre}>
                      <span>{cultivo.nombre}</span>
                      <strong>{numero(cultivo.total)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="panel-vacio">
                  Aún no hay cultivos registrados.
                </p>
              )}
            </article>

            <article className="panel-caja">
              <h2>Foro por categoría</h2>
              {metricas.foro_por_categoria?.length ? (
                <ul className="panel-lista">
                  {metricas.foro_por_categoria.map((item) => (
                    <li key={item.categoria}>
                      <span>{item.categoria}</span>
                      <strong>{numero(item.total)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="panel-vacio">
                  Aún no hay publicaciones.
                </p>
              )}
            </article>
          </section>

          <p className="panel-nota">
            Cifras agregadas de la plataforma. Por privacidad, el panel no
            muestra datos individuales de cada usuario. Actualizado:{" "}
            {formatearFecha(metricas.generado_en)}.
          </p>
        </>
      )}

      {pestana === "foro" && (
        <section className="panel-caja panel-foro">
          <div className="panel-foro-cabecera">
            <div>
              <h2>Moderación del foro</h2>
              <p>Busca publicaciones y filtra por categoría.</p>
            </div>
            <button
              type="button"
              className="panel-boton-suave"
              onClick={exportarForo}
              disabled={publicacionesFiltradas.length === 0}
            >
              <Download size={16} /> Exportar foro filtrado CSV
            </button>
          </div>

          <div className="panel-filtros">
            <label className="panel-busqueda">
              <Search size={17} />
              <input
                type="search"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Buscar título, contenido o autor…"
                aria-label="Buscar publicaciones"
              />
            </label>

            <label className="panel-categoria-filtro">
              <span>Categoría</span>
              <select
                value={categoria}
                onChange={(evento) => setCategoria(evento.target.value)}
              >
                <option value="todas">Todas las categorías</option>
                {categorias.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="panel-conteo-foro" aria-live="polite">
            Mostrando <strong>{publicacionesFiltradas.length}</strong> de{" "}
            <strong>{publicaciones.length}</strong> publicaciones.
          </p>

          {!cargando && publicacionesFiltradas.length === 0 && (
            <p className="panel-vacio">
              No hay publicaciones que coincidan con esos filtros.
            </p>
          )}

          <ul className="panel-publicaciones">
            {publicacionesFiltradas.map((publicacion) => (
              <li key={publicacion.id}>
                <div className="panel-publicacion-texto">
                  <div className="panel-publicacion-meta">
                    {publicacion.categoria && (
                      <span className="panel-etiqueta">
                        {publicacion.categoria}
                      </span>
                    )}
                    <span>{publicacion.autor_nombre || "Usuario"}</span>
                    <span>·</span>
                    <span>{formatearFecha(publicacion.created_at)}</span>
                  </div>

                  <h3>{publicacion.titulo}</h3>
                  <p>{publicacion.contenido}</p>
                </div>

                <button
                  type="button"
                  className="panel-boton-peligro"
                  onClick={() => borrar(publicacion)}
                  disabled={eliminando === publicacion.id}
                  aria-label={`Eliminar ${publicacion.titulo}`}
                >
                  <Trash2 size={15} />
                  {eliminando === publicacion.id
                    ? "Eliminando…"
                    : "Eliminar"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
