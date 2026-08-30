'use client'; 
import { useState, useEffect, useRef } from 'react'; 
import { Card } from 'primereact/card'; 
import { DataTable } from 'primereact/datatable'; 
import { Column } from 'primereact/column'; 
import { Tag } from 'primereact/tag'; 
import { Toast } from 'primereact/toast'; 
import { ProgressSpinner } from 'primereact/progressspinner'; 
import { Button } from 'primereact/button'; 
import { Calendar } from 'primereact/calendar'; 
import { Dropdown } from 'primereact/dropdown'; 
import { InputText } from 'primereact/inputtext'; 
import { Divider } from 'primereact/divider'; 
import { Dialog } from 'primereact/dialog';
import { PickList } from 'primereact/picklist';
import { Checkbox } from 'primereact/checkbox';
import { RadioButton } from 'primereact/radiobutton';
import { SelectButton } from 'primereact/selectbutton';
import { FileUpload, FileUploadHandlerEvent } from 'primereact/fileupload';
import * as XLSX from 'xlsx';
import {
  fetchClientesConViajesUltraRapido as fetchClientesConViajes,
  fetchViajesConFiltrosOptimizado as fetchViajesConFiltros,
  exportarEstimacionExcel,
  exportarEstimacionMaquinariaExcel,
  fetchOpcionesFiltros,
  fetchConfiguracionesExportacion,
  guardarConfiguracionExportacion,
  eliminarConfiguracionExportacion,
  COLUMNAS_DISPONIBLES_EXPORTACION,
  COLUMNAS_EXPORTACION_ESTANDAR,
  EstimacionCliente,
  ViajeEstimacion,
  FiltrosEstimacion,
  ConfiguracionExportacion
} from '../../../../../Services/BD/estimacionesService';
import { updateViajesEstatusBulk, fetchViajesPorIdentificadores, ViajeIdentificado, EstatusViaje } from '../../../../../Services/BD/viajeService';
import { fetchRentaMaquinariaPorCliente, RentaMaquinaria } from '../../../../../Services/BD/inventario/maquinaria/rentaMaquinariaService';

type TipoEstimacion = 'camion' | 'maquinaria';

const OPCIONES_TIPO_ESTIMACION: { label: string; value: TipoEstimacion }[] = [
  { label: 'Camión', value: 'camion' },
  { label: 'Maquinaria', value: 'maquinaria' }
];

// Clientes sin etiqueta asignada se tratan como "camion" para no romper el comportamiento previo.
const tiposDisponiblesCliente = (cliente: EstimacionCliente): TipoEstimacion[] => {
  const tags = (cliente.etiquetas || []) as TipoEstimacion[];
  return tags.length > 0 ? tags : ['camion'];
};

const etiquetasBodyEstimacion = (etiquetas: string[] | undefined) => {
  if (!etiquetas || etiquetas.length === 0) return <span>-</span>;
  return (
    <div className="flex gap-1 flex-wrap">
      {etiquetas.map(etiqueta => (
        <Tag key={etiqueta} value={etiqueta === 'camion' ? 'Camión' : 'Maquinaria'} severity={etiqueta === 'camion' ? 'info' : 'warning'} />
      ))}
    </div>
  );
};

type ColumnaExportacion = { key: string; label: string };

type ClasificacionFilaSubida = 'actualizara' | 'confirmar' | 'sinCambio' | 'noEncontrado' | 'duplicado' | 'sinIdentificador';

interface FilaSubidaEstatus {
  fila: number;
  folio: string | null;
  folioBco: string | null;
  identificadorUsado: string;
  viaje: ViajeIdentificado | null;
  clasificacion: ClasificacionFilaSubida;
  incluir: boolean;
}

const ETIQUETA_CLASIFICACION: Record<ClasificacionFilaSubida, string> = {
  actualizara: 'Se actualizará',
  confirmar: 'Sin estatus: requiere confirmación',
  sinCambio: 'Sin cambios (no está en "estimado")',
  noEncontrado: 'No encontrado en viajes',
  duplicado: 'Folio duplicado en el Excel',
  sinIdentificador: 'Fila sin Folio ni Folio BCO'
};

const SEVERIDAD_CLASIFICACION: Record<ClasificacionFilaSubida, 'info' | 'warning' | 'success' | 'danger'> = {
  actualizara: 'success',
  confirmar: 'warning',
  sinCambio: 'info',
  noEncontrado: 'danger',
  duplicado: 'danger',
  sinIdentificador: 'danger'
};

const normalizarTextoSubida = (v: any): string | null => {
  const t = String(v ?? '').trim();
  return t === '' ? null : t;
};

const normalizarComparacionSubida = (v: string): string =>
  v.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const OPCIONES_ESTATUS: { label: string; value: EstatusViaje }[] = [
  { label: 'Estimado', value: 'estimado' },
  { label: 'Aprobado', value: 'aprobado' },
  { label: 'Facturado', value: 'facturado' },
  { label: 'Pagado', value: 'pagado' }
];

const ESTATUS_SEVERIDAD: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
  estimado: 'info',
  aprobado: 'warning',
  facturado: 'success',
  pagado: 'success'
};

const EstimacionesCrud = () => { 
  const [clientes, setClientes] = useState<EstimacionCliente[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<EstimacionCliente | null>(null);
  const [viajesFiltrados, setViajesFiltrados] = useState<ViajeEstimacion[]>([]);
  const [viajesSeleccionados, setViajesSeleccionados] = useState<ViajeEstimacion[]>([]);
  const [tipoVista, setTipoVista] = useState<TipoEstimacion>('camion');
  const [rentasFiltradas, setRentasFiltradas] = useState<RentaMaquinaria[]>([]);
  const [cambiarEstatusDialog, setCambiarEstatusDialog] = useState(false);
  const [nuevoEstatus, setNuevoEstatus] = useState<EstatusViaje | null>(null);
  const [guardandoEstatus, setGuardandoEstatus] = useState(false);

  // --- Subir Excel para cambiar estatus en lote (a partir del Excel exportado) ---
  const [subirExcelDialog, setSubirExcelDialog] = useState(false);
  const [estatusDestinoSubida, setEstatusDestinoSubida] = useState<EstatusViaje | null>(null);
  const [nombreArchivoSubido, setNombreArchivoSubido] = useState('');
  const [filasSubidas, setFilasSubidas] = useState<FilaSubidaEstatus[]>([]);
  const [procesandoSubida, setProcesandoSubida] = useState(false);
  const [guardandoSubida, setGuardandoSubida] = useState(false);
  const [loading, setLoading] = useState({ clientes: true, viajes: false, opciones: false }); 
  const [filtros, setFiltros] = useState<FiltrosEstimacion>({
    fechaInicio: null,
    fechaFin: null,
    clienteId: null,
    operador: null,
    material: null,
    origen: null,
    destino: null,
    estatus: null
  });
  const [opcionesFiltros, setOpcionesFiltros] = useState<{operadores: string[], materiales: string[], origenes: string[], destinos: string[]}>({
    operadores: [],
    materiales: [],
    origenes: [],
    destinos: []
  });
  const [showFiltros, setShowFiltros] = useState(false);
  const [exportDialog, setExportDialog] = useState(false);

  // --- Personalización de la exportación a Excel ---
  const [configuraciones, setConfiguraciones] = useState<ConfiguracionExportacion[]>([]);
  const [configSeleccionadaId, setConfigSeleccionadaId] = useState<number | null>(null); // null = Estándar
  const [modoExportacion, setModoExportacion] = useState<'estandar' | 'personalizado'>('estandar');
  const [columnasDisponibles, setColumnasDisponibles] = useState<ColumnaExportacion[]>([]);
  const [columnasSeleccionadas, setColumnasSeleccionadas] = useState<ColumnaExportacion[]>([]);
  const [incluirResumen, setIncluirResumen] = useState(true);
  const [incluirDetalle, setIncluirDetalle] = useState(true);
  const [incluirResumenPorMaterial, setIncluirResumenPorMaterial] = useState(true);
  const [guardarConfigDialog, setGuardarConfigDialog] = useState(false);
  const [nombreNuevaConfig, setNombreNuevaConfig] = useState('');
  const [guardandoConfig, setGuardandoConfig] = useState(false);

  const toast = useRef<Toast>(null);

  useEffect(() => { 
    const cargarDatosIniciales = async () => { 
      setLoading(prev => ({...prev, clientes: true, opciones: true})); 
      try { 
        const [clientesData, opcionesData] = await Promise.all([
          fetchClientesConViajes(),
          fetchOpcionesFiltros()
        ]);
        setClientes(clientesData); 
        setOpcionesFiltros(opcionesData);
      } catch (error) { 
        mostrarError('Error al cargar datos iniciales'); 
      } finally { 
        setLoading(prev => ({...prev, clientes: false, opciones: false})); 
      } 
    };
    const cargarConfiguracionesExportacion = async () => {
      try {
        const data = await fetchConfiguracionesExportacion();
        setConfiguraciones(data);
      } catch (error) {
        mostrarError('Error al cargar las configuraciones de exportación guardadas');
      }
    };
    cargarDatosIniciales();
    cargarConfiguracionesExportacion();
  }, []);

  // Prepara las listas de columnas disponibles/seleccionadas a partir de un arreglo de claves
  const construirListasColumnas = (clavesSeleccionadas: string[]) => {
    const seleccionadas = clavesSeleccionadas
      .map(key => COLUMNAS_DISPONIBLES_EXPORTACION.find(c => c.key === key))
      .filter((c): c is ColumnaExportacion => !!c);
    const disponibles = COLUMNAS_DISPONIBLES_EXPORTACION.filter(
      c => !clavesSeleccionadas.includes(c.key)
    );
    setColumnasSeleccionadas(seleccionadas);
    setColumnasDisponibles(disponibles);
  };

  const abrirDialogoExportacion = () => {
    setConfigSeleccionadaId(null);
    setModoExportacion('estandar');
    construirListasColumnas(COLUMNAS_EXPORTACION_ESTANDAR);
    setIncluirResumen(true);
    setIncluirDetalle(true);
    setIncluirResumenPorMaterial(true);
    setExportDialog(true);
  };

  const aplicarConfiguracionGuardada = (id: number | null) => {
    setConfigSeleccionadaId(id);
    if (id === null) {
      construirListasColumnas(COLUMNAS_EXPORTACION_ESTANDAR);
      setIncluirResumen(true);
      setIncluirDetalle(true);
      setIncluirResumenPorMaterial(true);
      return;
    }
    const config = configuraciones.find(c => c.id === id);
    if (!config) return;
    construirListasColumnas(config.columnas);
    setIncluirResumen(config.incluir_resumen);
    setIncluirDetalle(config.incluir_detalle);
    setIncluirResumenPorMaterial(config.incluir_resumen_material);
  };

  const guardarConfigActual = async () => {
    if (!nombreNuevaConfig.trim()) {
      mostrarError('Ponle un nombre a la configuración');
      return;
    }
    if (columnasSeleccionadas.length === 0) {
      mostrarError('Selecciona al menos una columna para guardar la configuración');
      return;
    }
    setGuardandoConfig(true);
    try {
      const nuevaConfig = await guardarConfiguracionExportacion({
        nombre: nombreNuevaConfig.trim(),
        columnas: columnasSeleccionadas.map(c => c.key),
        incluir_resumen: incluirResumen,
        incluir_detalle: incluirDetalle,
        incluir_resumen_material: incluirResumenPorMaterial
      });
      setConfiguraciones(prev => [...prev, nuevaConfig].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setConfigSeleccionadaId(nuevaConfig.id ?? null);
      setGuardarConfigDialog(false);
      setNombreNuevaConfig('');
      mostrarExito(`Configuración "${nuevaConfig.nombre}" guardada`);
    } catch (error) {
      mostrarError('Error al guardar la configuración');
    } finally {
      setGuardandoConfig(false);
    }
  };

  const eliminarConfigSeleccionada = async () => {
    if (configSeleccionadaId === null) return;
    const config = configuraciones.find(c => c.id === configSeleccionadaId);
    if (!config) return;
    if (!window.confirm(`¿Eliminar la configuración "${config.nombre}"?`)) return;

    try {
      await eliminarConfiguracionExportacion(configSeleccionadaId);
      setConfiguraciones(prev => prev.filter(c => c.id !== configSeleccionadaId));
      aplicarConfiguracionGuardada(null);
      mostrarExito('Configuración eliminada');
    } catch (error) {
      mostrarError('Error al eliminar la configuración');
    }
  };

  // Filtra las rentas de maquinaria localmente (fecha y operador), ya que renta_maquinaria
  // no tiene material/origen/destino/estatus como los viajes.
  const filtrarRentasLocal = (rentas: RentaMaquinaria[], f: FiltrosEstimacion): RentaMaquinaria[] => {
    return rentas.filter(r => {
      if (f.fechaInicio) {
        const inicioStr = f.fechaInicio.toISOString().split('T')[0];
        if ((r.fecha || '').split('T')[0] < inicioStr) return false;
      }
      if (f.fechaFin) {
        const finStr = f.fechaFin.toISOString().split('T')[0];
        if ((r.fecha || '').split('T')[0] > finStr) return false;
      }
      if (f.operador && !(r.operador_nombre || '').toLowerCase().includes(f.operador.toLowerCase())) return false;
      return true;
    });
  };

  const cargarRentasCliente = async (cliente: EstimacionCliente) => {
    setLoading(prev => ({...prev, viajes: true}));
    try {
      const rentas = await fetchRentaMaquinariaPorCliente(cliente.id_cliente);
      setRentasFiltradas(rentas);
    } catch (error) {
      mostrarError(`Error al cargar rentas de maquinaria de ${cliente.cliente_nombre}`);
    } finally {
      setLoading(prev => ({...prev, viajes: false}));
    }
  };

  const aplicarFiltros = async () => {
    if (!clienteSeleccionado) {
      mostrarError('Selecciona un cliente primero');
      return;
    }

    setLoading(prev => ({...prev, viajes: true}));
    try {
      if (tipoVista === 'camion') {
        const viajes = await fetchViajesConFiltros({
          ...filtros,
          clienteId: clienteSeleccionado.id_cliente
        });
        setViajesFiltrados(viajes);
        mostrarExito(`Filtros aplicados: ${viajes.length} viajes encontrados`);
      } else {
        const todas = await fetchRentaMaquinariaPorCliente(clienteSeleccionado.id_cliente);
        const filtradas = filtrarRentasLocal(todas, filtros);
        setRentasFiltradas(filtradas);
        mostrarExito(`Filtros aplicados: ${filtradas.length} renta(s) de maquinaria encontradas`);
      }
      setShowFiltros(false);
    } catch (error) {
      mostrarError('Error al aplicar filtros');
    } finally {
      setLoading(prev => ({...prev, viajes: false}));
    }
  };

  const limpiarFiltros = () => {
    setFiltros({
      fechaInicio: null,
      fechaFin: null,
      clienteId: null,
      operador: null,
      material: null,
      origen: null,
      destino: null,
      estatus: null
    });
    if (clienteSeleccionado) {
      if (tipoVista === 'camion') {
        cargarViajesCliente(clienteSeleccionado);
      } else {
        cargarRentasCliente(clienteSeleccionado);
      }
    } else {
      setViajesFiltrados([]);
      setRentasFiltradas([]);
    }
    mostrarExito('Filtros limpiados');
  };

  const cargarViajesCliente = async (cliente: EstimacionCliente) => {
    setLoading(prev => ({...prev, viajes: true}));
    try {
      const viajes = await fetchViajesConFiltros({
        clienteId: cliente.id_cliente,
        fechaInicio: null,
        fechaFin: null,
        operador: null,
        material: null,
        origen: null,
        destino: null,
        estatus: null
      });
      setViajesFiltrados(viajes);
    } catch (error) {
      mostrarError(`Error al cargar viajes de ${cliente.cliente_nombre}`);
    } finally {
      setLoading(prev => ({...prev, viajes: false}));
    }
  };

  const handleClienteClick = async (cliente: EstimacionCliente) => {
    if (clienteSeleccionado?.id_cliente === cliente.id_cliente) {
      setClienteSeleccionado(null);
      setViajesFiltrados([]);
      setRentasFiltradas([]);
      setViajesSeleccionados([]);
      return;
    }

    setClienteSeleccionado(cliente);
    setViajesSeleccionados([]);
    const tipos = tiposDisponiblesCliente(cliente);
    const tipoInicial: TipoEstimacion = tipos.includes('camion') ? 'camion' : tipos[0];
    setTipoVista(tipoInicial);
    if (tipoInicial === 'camion') {
      await cargarViajesCliente(cliente);
    } else {
      await cargarRentasCliente(cliente);
    }
  };

  // Cambia entre la vista de Camión y Maquinaria para el cliente ya seleccionado
  const cambiarTipoVista = async (tipo: TipoEstimacion) => {
    if (!clienteSeleccionado || tipo === tipoVista) return;
    setTipoVista(tipo);
    setViajesSeleccionados([]);
    if (tipo === 'camion') {
      await cargarViajesCliente(clienteSeleccionado);
    } else {
      await cargarRentasCliente(clienteSeleccionado);
    }
  };

  const abrirCambiarEstatus = () => {
    if (viajesSeleccionados.length === 0) return;
    setNuevoEstatus(null);
    setCambiarEstatusDialog(true);
  };

  const cerrarCambiarEstatus = () => {
    if (guardandoEstatus) return;
    setCambiarEstatusDialog(false);
    setNuevoEstatus(null);
  };

  const guardarCambioEstatus = async () => {
    if (!nuevoEstatus || viajesSeleccionados.length === 0) return;
    setGuardandoEstatus(true);
    try {
      const ids = viajesSeleccionados.map(v => v.id);
      await updateViajesEstatusBulk(ids, nuevoEstatus);
      setViajesFiltrados(prev => prev.map(v => (ids.includes(v.id) ? { ...v, estatus: nuevoEstatus } : v)));
      setViajesSeleccionados([]);
      mostrarExito(`Estatus actualizado a "${nuevoEstatus}" en ${ids.length} viaje(s)`);
      cerrarCambiarEstatus();
    } catch (error) {
      mostrarError('Error al actualizar el estatus de los viajes seleccionados');
    } finally {
      setGuardandoEstatus(false);
    }
  };

  // --- Subir Excel: re-sube el Excel exportado (o cualquiera con columnas Folio/Folio
  // BCO) y cambia a "estatusDestinoSubida" los viajes que hoy están en "estimado".
  // Los viajes sin estatus (null) no se tocan automáticamente: se marcan como
  // "confirmar" y el usuario tiene que tildarlos a mano en la tabla de previsualización.
  const abrirSubirExcel = () => {
    setEstatusDestinoSubida(null);
    setNombreArchivoSubido('');
    setFilasSubidas([]);
    setSubirExcelDialog(true);
  };

  const cerrarSubirExcel = () => {
    if (guardandoSubida) return;
    setSubirExcelDialog(false);
    setNombreArchivoSubido('');
    setFilasSubidas([]);
  };

  const procesarArchivoSubido = async (file: File) => {
    setProcesandoSubida(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const nombreHoja = wb.SheetNames.includes('Viajes Detallados') ? 'Viajes Detallados' : wb.SheetNames[0];
      const hoja = wb.Sheets[nombreHoja];
      const filasExcel = XLSX.utils.sheet_to_json<any>(hoja, { defval: '' });

      if (filasExcel.length === 0) {
        toast.current?.show({ severity: 'warn', summary: 'Archivo vacío', detail: 'El Excel no tiene filas de datos', life: 4000 });
        setFilasSubidas([]);
        return;
      }

      const brutas = filasExcel.map((fila, indice) => ({
        fila: indice + 2,
        folio: normalizarTextoSubida(fila['Folio']),
        folioBco: normalizarTextoSubida(fila['Folio BCO'])
      }));

      const folios = Array.from(new Set(brutas.map(b => b.folio).filter((v): v is string => !!v)));
      const foliosBco = Array.from(new Set(brutas.map(b => b.folioBco).filter((v): v is string => !!v)));

      if (folios.length === 0 && foliosBco.length === 0) {
        mostrarError('El Excel no tiene columnas "Folio" ni "Folio BCO" con datos');
        setFilasSubidas([]);
        return;
      }

      const viajesEncontrados = await fetchViajesPorIdentificadores(folios, foliosBco);
      const porFolio = new Map<string, ViajeIdentificado>();
      const porFolioBco = new Map<string, ViajeIdentificado>();
      viajesEncontrados.forEach(v => {
        if (v.folio) porFolio.set(normalizarComparacionSubida(v.folio), v);
        if (v.folio_bco) porFolioBco.set(normalizarComparacionSubida(v.folio_bco), v);
      });

      // El identificador que se usa para buscar/comparar duplicados es Folio BCO si
      // viene en la fila; si no, se cae a Folio, tal como pediste.
      const conIdentificador = brutas.map(b => ({ ...b, identificador: b.folioBco || b.folio }));

      const conteoIdentificador = new Map<string, number>();
      conIdentificador.forEach(b => {
        if (!b.identificador) return;
        const key = normalizarComparacionSubida(b.identificador);
        conteoIdentificador.set(key, (conteoIdentificador.get(key) || 0) + 1);
      });

      const procesadas: FilaSubidaEstatus[] = conIdentificador.map(b => {
        if (!b.identificador) {
          return { fila: b.fila, folio: b.folio, folioBco: b.folioBco, identificadorUsado: '', viaje: null, clasificacion: 'sinIdentificador', incluir: false };
        }

        const key = normalizarComparacionSubida(b.identificador);
        if ((conteoIdentificador.get(key) || 0) > 1) {
          return { fila: b.fila, folio: b.folio, folioBco: b.folioBco, identificadorUsado: b.identificador, viaje: null, clasificacion: 'duplicado', incluir: false };
        }

        const viaje = (b.folioBco ? porFolioBco.get(key) : porFolio.get(key)) ?? null;
        if (!viaje) {
          return { fila: b.fila, folio: b.folio, folioBco: b.folioBco, identificadorUsado: b.identificador, viaje: null, clasificacion: 'noEncontrado', incluir: false };
        }

        // Cualquier estatus actual (incluido "estimado") se puede cambiar al estatus
        // seleccionado. Solo los viajes sin estatus todavía piden confirmación manual.
        if (!viaje.estatus) {
          return { fila: b.fila, folio: b.folio, folioBco: b.folioBco, identificadorUsado: b.identificador, viaje, clasificacion: 'confirmar', incluir: false };
        }

        return { fila: b.fila, folio: b.folio, folioBco: b.folioBco, identificadorUsado: b.identificador, viaje, clasificacion: 'actualizara', incluir: true };
      });

      setFilasSubidas(procesadas);
    } catch (error) {
      console.error('Error leyendo el archivo de estatus:', error);
      mostrarError('No se pudo leer el archivo. Verifica que sea un Excel válido.');
      setFilasSubidas([]);
    } finally {
      setProcesandoSubida(false);
    }
  };

  const manejarArchivoSubido = async (e: FileUploadHandlerEvent) => {
    const file = e.files?.[0];
    if (!file) return;
    setNombreArchivoSubido(file.name);
    await procesarArchivoSubido(file);
  };

  const alternarIncluirFila = (fila: number) => {
    setFilasSubidas(prev => prev.map(f => (f.fila === fila && f.clasificacion === 'confirmar' ? { ...f, incluir: !f.incluir } : f)));
  };

  const filasAActualizar = filasSubidas.filter(f => f.incluir && f.viaje);

  const guardarSubidaEstatus = async () => {
    if (!estatusDestinoSubida || filasAActualizar.length === 0) return;
    setGuardandoSubida(true);
    try {
      const ids = Array.from(new Set(filasAActualizar.map(f => f.viaje!.id)));
      await updateViajesEstatusBulk(ids, estatusDestinoSubida);
      mostrarExito(`Estatus actualizado a "${estatusDestinoSubida}" en ${ids.length} viaje(s)`);
      cerrarSubirExcel();
      if (clienteSeleccionado) await cargarViajesCliente(clienteSeleccionado);
    } catch (error) {
      console.error('Error guardando el cambio de estatus desde Excel:', error);
      mostrarError('No se pudo completar la actualización de estatus');
    } finally {
      setGuardandoSubida(false);
    }
  };

  const mostrarError = (mensaje: string) => {
    toast.current?.show({ severity: 'error', summary: 'Error', detail: mensaje, life: 5000 }); 
  }; 

  const mostrarExito = (mensaje: string) => { 
    toast.current?.show({ severity: 'success', summary: 'Éxito', detail: mensaje, life: 3000 }); 
  }; 

  const formatCurrency = (value: number) => { 
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value); 
  }; 

  const fechaBodyTemplate = (rowData: ViajeEstimacion) => { 
    if (!rowData.fecha) return '-'; 
    const [year, month, day] = rowData.fecha.split('T')[0].split('-'); 
    return `${day}-${month}-${year}`; 
  }; 

  // Función para exportar a Excel (rama según tipoVista: Camión usa el flujo existente
  // con hojas/columnas personalizables; Maquinaria usa una hoja estándar más simple).
  const exportarAExcel = async () => {
    if (!clienteSeleccionado) {
      mostrarError('No hay datos para exportar');
      return;
    }

    if (tipoVista === 'maquinaria') {
      if (rentasFiltradas.length === 0) {
        mostrarError('No hay datos para exportar');
        return;
      }
      setLoading(prev => ({...prev, viajes: true}));
      try {
        await exportarEstimacionMaquinariaExcel(rentasFiltradas, clienteSeleccionado);
        mostrarExito('Estimación de maquinaria exportada a Excel correctamente');
        setExportDialog(false);
      } catch (error) {
        console.error('Error al exportar:', error);
        mostrarError('Error al exportar la estimación a Excel');
      } finally {
        setLoading(prev => ({...prev, viajes: false}));
      }
      return;
    }

    if (viajesFiltrados.length === 0) {
      mostrarError('No hay datos para exportar');
      return;
    }
    if (!incluirResumen && !incluirDetalle && !incluirResumenPorMaterial) {
      mostrarError('Selecciona al menos una hoja para exportar');
      return;
    }
    if (incluirDetalle && columnasSeleccionadas.length === 0) {
      mostrarError('Selecciona al menos una columna para la hoja de Viajes Detallados');
      return;
    }

    setLoading(prev => ({...prev, viajes: true}));
    try {
      // Intenta cargar el logo (opcional)
      let logoBase64: string | undefined;

      try {
        // Ruta relativa desde public - ASÍ ES CORRECTO:
        logoBase64 = await convertirImagenABase64('/img/Logo.png');
        console.log('Logo cargado correctamente:', logoBase64?.substring(0, 50) + '...');
      } catch (logoError) {
        console.warn('No se pudo cargar el logo, exportando sin él:', logoError);
        // Continuar sin logo
      }

      await exportarEstimacionExcel(
        viajesFiltrados,
        clienteSeleccionado,
        filtros,
        undefined, // logoBase64 // FALTA POR DEFINIR SI SE USA O NO
        {
          columnas: columnasSeleccionadas.map(c => c.key),
          incluirResumen,
          incluirDetalle,
          incluirResumenPorMaterial
        }
      );

      mostrarExito('Estimación exportada a Excel correctamente');
      setExportDialog(false);
    } catch (error) {
      console.error('Error al exportar:', error);
      mostrarError('Error al exportar la estimación a Excel');
    } finally {
      setLoading(prev => ({...prev, viajes: false}));
    }
  };

  // Función para convertir imagen a base64 (CORREGIDA)
  const convertirImagenABase64 = async (url: string): Promise<string> => {
    try {
      // Para rutas en Next.js, las imágenes públicas van en la carpeta "public"
      // Ejemplo: public/Logo.png -> '/Logo.png'
      // Ejemplo: public/img/Logo.png -> '/img/Logo.png'
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`No se pudo cargar la imagen: ${response.status}`);
      }
      
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Error al convertir imagen'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error al convertir imagen a base64:', error);
      throw error; // Propagar el error
    }
  };

  // Calcular totales (Camión)
  const totalViajes = viajesFiltrados.length;
  const totalM3 = viajesFiltrados.reduce((sum, viaje) => sum + viaje.m3, 0);
  const totalCobrar = viajesFiltrados.reduce((sum, viaje) => sum + viaje.total_viaje, 0);
  const totalHorasRenta = viajesFiltrados.reduce((sum, viaje) => sum + (viaje.horas_renta || 0), 0);

  // Calcular totales (Maquinaria)
  const totalRentas = rentasFiltradas.length;
  const totalHrsMaquinaria = rentasFiltradas.reduce((sum, r) => sum + (r.hrs || 0), 0);
  const totalCobrarMaquinaria = rentasFiltradas.reduce((sum, r) => sum + (r.total || 0), 0);

  return ( 
    <div className="grid"> 
      <div className="col-12"> 
        <Toast ref={toast} /> 
        <div className="flex justify-content-between align-items-center mb-4"> 
          <h2>Estimaciones por Cliente</h2> 
          <div className="flex align-items-center gap-4"> 
            <div className="bg-white border-round p-3 surface-card shadow-1"> 
              <span className="block text-sm text-color-secondary">Total Clientes:</span> 
              <span className="text-xl font-medium text-blue-500">
                {clientes.length}
              </span> 
            </div> 
          </div> 
        </div> 

        {loading.clientes ? ( 
          <div className="flex justify-content-center"> 
            <ProgressSpinner /> 
          </div> 
        ) : ( 
          <>
            {/* Tabla de Clientes */}
            <DataTable 
              value={clientes} 
              selectionMode="single"
              selection={clienteSeleccionado}
              onSelectionChange={(e) => handleClienteClick(e.value as EstimacionCliente)}
              dataKey="id_cliente"
              className="p-datatable-sm mb-4"
              emptyMessage="No se encontraron clientes con estimaciones"
              paginator
              rows={5}
              rowsPerPageOptions={[5, 10, 25]}
              showGridlines
            >
              <Column
                field="cliente_nombre"
                header="Cliente"
                body={(row) => (
                  <span className="font-medium">{row.cliente_nombre}</span>
                )}
              />
              <Column
                header="Etiqueta"
                body={(row: EstimacionCliente) => etiquetasBodyEstimacion(row.etiquetas)}
              />
              <Column
                field="total_viajes"
                header="Total Viajes"
              />
              <Column 
                field="total_m3" 
                header="Total M3" 
                body={(row) => row.total_m3.toFixed(2)}
              />
              <Column 
                field="total_cobrar" 
                header="Total a Cobrar" 
                body={(row) => formatCurrency(row.total_cobrar)}
              />
              <Column 
                field="obra" 
                header="Obra" 
                body={(row) => row.obra || 'No especificada'}
              />
            </DataTable>

            {clienteSeleccionado && ( 
              <div className="mt-5"> 
                <Card
                  title={`Estimación - ${clienteSeleccionado.cliente_nombre}`}
                  subTitle={
                    <div className="flex flex-column gap-2">
                      <div className="flex justify-content-between align-items-center flex-wrap gap-2">
                        <div className="flex align-items-center gap-3">
                          <span>
                            Fecha de estimación: {new Date().toLocaleDateString('es-MX')}
                          </span>
                          {etiquetasBodyEstimacion(clienteSeleccionado.etiquetas)}
                          {tiposDisponiblesCliente(clienteSeleccionado).length > 1 && (
                            <SelectButton
                              value={tipoVista}
                              onChange={(e) => { if (e.value) cambiarTipoVista(e.value); }}
                              options={OPCIONES_TIPO_ESTIMACION}
                              disabled={loading.viajes}
                            />
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            icon="pi pi-filter"
                            label="Filtrar"
                            className="p-button-outlined"
                            onClick={() => setShowFiltros(true)}
                            disabled={loading.viajes}
                          />
                          {tipoVista === 'camion' && (
                            <>
                              <Button
                                icon="pi pi-flag"
                                label="Cambiar Estatus"
                                className="p-button-outlined p-button-warning"
                                onClick={abrirCambiarEstatus}
                                disabled={viajesSeleccionados.length === 0 || loading.viajes}
                              />
                              <Button
                                icon="pi pi-upload"
                                label="Subir Excel"
                                className="p-button-outlined"
                                onClick={abrirSubirExcel}
                                disabled={loading.viajes}
                              />
                            </>
                          )}
                          <Button
                            icon="pi pi-download"
                            label="Exportar Excel"
                            className="p-button-success"
                            onClick={abrirDialogoExportacion}
                            disabled={(tipoVista === 'camion' ? viajesFiltrados.length === 0 : rentasFiltradas.length === 0) || loading.viajes}
                          />
                        </div>
                      </div>
                    </div>
                  }
                >
                  {/* Información del cliente */}
                  <div className="grid mb-4">
                    <div className="col-12 md:col-4">
                      <strong>Obra:</strong> {clienteSeleccionado.obra || 'No especificada'}
                    </div>
                    <div className="col-12 md:col-4">
                      <strong>Responsable:</strong> {clienteSeleccionado.contacto || 'No especificado'}
                    </div>
                    <div className="col-12 md:col-4">
                      <strong>{tipoVista === 'camion' ? 'Total Viajes:' : 'Total Rentas:'}</strong> {tipoVista === 'camion' ? totalViajes : totalRentas}
                    </div>
                  </div>

                  {/* Resumen de la estimación */}
                  <div className="grid mb-4">
                    <div className="col-12 md:col-6">
                      <Card className="bg-blue-50">
                        <div className="flex justify-content-between">
                          <span>{tipoVista === 'camion' ? 'Total M3:' : 'Total Hrs:'}</span>
                          <strong>{tipoVista === 'camion' ? `${totalM3.toFixed(2)} m³` : `${totalHrsMaquinaria.toFixed(2)} hrs`}</strong>
                        </div>
                      </Card>
                    </div>
                    <div className="col-12 md:col-6">
                      <Card className="bg-green-50">
                        <div className="flex justify-content-between">
                          <span>Total a Cobrar:</span>
                          <strong>{formatCurrency(tipoVista === 'camion' ? totalCobrar : totalCobrarMaquinaria)}</strong>
                        </div>
                      </Card>
                    </div>
                  </div>

                  {loading.viajes ? (
                    <div className="flex justify-content-center">
                      <ProgressSpinner />
                    </div>
                  ) : tipoVista === 'camion' ? (
                    <DataTable
                      value={viajesFiltrados}
                      paginator
                      rows={10}
                      rowsPerPageOptions={[5, 10, 25, 50]}
                      emptyMessage="No se encontraron viajes con los filtros aplicados"
                      className="p-datatable-sm"
                      showGridlines
                      selectionMode="multiple"
                      selection={viajesSeleccionados}
                      onSelectionChange={(e) => setViajesSeleccionados(e.value as ViajeEstimacion[])}
                      dataKey="id"
                    >
                      <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />
                      <Column field="numero_viaje" header="No. Viaje" style={{ width: '80px' }} />
                      <Column field="fecha" header="Fecha" body={fechaBodyTemplate} style={{ width: '120px' }} />
                      <Column field="folio" header="Folio" style={{ width: '120px' }} />
                      <Column field="folio_bco" header="Folio BCO" style={{ width: '90px' }} />
                      <Column field="origen" header="Origen" />
                      <Column field="destino" header="Destino" />
                      <Column field="material" header="Material" />
                      <Column field="operador" header="Operador" />
                      <Column field="total_horas_renta" header="Hrs Renta" body={() => totalHorasRenta} />
                      <Column field="m3" header="M3" body={(row) => row.m3.toFixed(2)} style={{ width: '100px' }} />
                      <Column field="precio" header="Precio Unitario" body={(row) => formatCurrency(row.precio)} style={{ width: '130px' }} />
                      <Column
                        field="estatus"
                        header="Estatus"
                        body={(row: ViajeEstimacion) =>
                          row.estatus ? <Tag severity={ESTATUS_SEVERIDAD[row.estatus] ?? 'info'} value={row.estatus} /> : '-'
                        }
                        style={{ width: '120px' }}
                      />
                      <Column
                        field="total_viaje"
                        header="Total Viaje"
                        body={(row) => (
                          <strong className="text-green-600">{formatCurrency(row.total_viaje)}</strong>
                        )}
                        style={{ width: '130px' }}
                      />
                    </DataTable>
                  ) : (
                    <DataTable
                      value={rentasFiltradas}
                      paginator
                      rows={10}
                      rowsPerPageOptions={[5, 10, 25, 50]}
                      emptyMessage="No se encontraron rentas de maquinaria con los filtros aplicados"
                      className="p-datatable-sm"
                      showGridlines
                      dataKey="id"
                    >
                      <Column field="fecha" header="Fecha" body={(row: RentaMaquinaria) => (row.fecha ? row.fecha.split('T')[0].split('-').reverse().join('-') : '-')} style={{ width: '110px' }} />
                      <Column field="estimacion" header="Estimación" body={(row: RentaMaquinaria) => row.estimacion || '-'} style={{ width: '120px' }} />
                      <Column field="folio" header="Folio" body={(row: RentaMaquinaria) => row.folio || '-'} style={{ width: '110px' }} />
                      <Column field="maquina_nombre" header="Máquina" body={(row: RentaMaquinaria) => row.maquina_nombre || '-'} />
                      <Column field="operador_nombre" header="Operador" body={(row: RentaMaquinaria) => row.operador_nombre || '-'} />
                      <Column field="hrs" header="Hrs" body={(row: RentaMaquinaria) => (row.hrs != null ? row.hrs.toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '-')} style={{ width: '100px' }} />
                      <Column field="precio" header="Precio" body={(row: RentaMaquinaria) => formatCurrency(row.precio || 0)} style={{ width: '130px' }} />
                      <Column
                        field="total"
                        header="Total"
                        body={(row: RentaMaquinaria) => (
                          <strong className="text-green-600">{formatCurrency(row.total || 0)}</strong>
                        )}
                        style={{ width: '130px' }}
                      />
                      <Column field="observaciones" header="Observaciones" body={(row: RentaMaquinaria) => row.observaciones || '-'} />
                    </DataTable>
                  )}
                </Card>
              </div> 
            )} 
          </>
        )} 

        {/* Diálogo de Filtros */}
        <Dialog
          visible={showFiltros}
          onHide={() => setShowFiltros(false)}
          header={tipoVista === 'camion' ? 'Filtrar Viajes' : 'Filtrar Rentas de Maquinaria'}
          style={{ width: '500px' }}
        >
          <div className="p-fluid">
            {clienteSeleccionado && tiposDisponiblesCliente(clienteSeleccionado).length > 1 && (
              <div className="field">
                <label>Tipo</label>
                <SelectButton
                  value={tipoVista}
                  onChange={(e) => { if (e.value) setTipoVista(e.value); }}
                  options={OPCIONES_TIPO_ESTIMACION}
                />
              </div>
            )}

            <div className="field">
              <label>Rango de Fechas</label>
              <div className="flex gap-2">
                <Calendar 
                  value={filtros.fechaInicio} 
                  onChange={(e) => setFiltros({...filtros, fechaInicio: e.value ?? null})}
                  dateFormat="yy-mm-dd"
                  placeholder="Fecha inicio"
                  showIcon
                  readOnlyInput
                />
                <Calendar 
                  value={filtros.fechaFin} 
                  onChange={(e) => setFiltros({...filtros, fechaFin: e.value ?? null})}
                  dateFormat="yy-mm-dd"
                  placeholder="Fecha fin"
                  showIcon
                  readOnlyInput
                />
              </div>
            </div>
            
            <div className="field">
              <label>Operador</label>
              <Dropdown 
                value={filtros.operador} 
                onChange={(e) => setFiltros({...filtros, operador: e.value})}
                options={opcionesFiltros.operadores}
                placeholder="Seleccionar operador"
                showClear
                filter
              />
            </div>
            
            {tipoVista === 'camion' && (
              <>
                <div className="field">
                  <label>Material</label>
                  <Dropdown
                    value={filtros.material}
                    onChange={(e) => setFiltros({...filtros, material: e.value})}
                    options={opcionesFiltros.materiales}
                    placeholder="Seleccionar material"
                    showClear
                    filter
                  />
                </div>
                <div className="field">
                  <label>Origen</label>
                  <Dropdown
                    value={filtros.origen}
                    onChange={(e) => setFiltros({...filtros, origen: e.value})}
                    options={opcionesFiltros.origenes}
                    placeholder="Seleccionar origen"
                    showClear
                    filter
                  />
                </div>

                <div className="field">
                  <label>Destino</label>
                  <Dropdown
                    value={filtros.destino}
                    onChange={(e) => setFiltros({...filtros, destino: e.value})}
                    options={opcionesFiltros.destinos}
                    placeholder="Seleccionar destino"
                    showClear
                    filter
                  />
                </div>

                <div className="field">
                  <label>Estatus</label>
                  <Dropdown
                    value={filtros.estatus}
                    onChange={(e) => setFiltros({...filtros, estatus: e.value})}
                    options={[...OPCIONES_ESTATUS, { label: 'Sin estatus', value: '__sin_estatus__' }]}
                    placeholder="Seleccionar estatus"
                    showClear
                  />
                </div>
              </>
            )}
          </div>
          
          <div className="flex justify-content-between gap-2 mt-4">
            <Button 
              label="Limpiar Filtros" 
              icon="pi pi-times" 
              className="p-button-text" 
              onClick={limpiarFiltros}
              disabled={loading.viajes}
            />
            <div className="flex gap-2">
              <Button 
                label="Cancelar" 
                icon="pi pi-times" 
                className="p-button-text" 
                onClick={() => setShowFiltros(false)}
                disabled={loading.viajes}
              />
              <Button 
                label="Aplicar Filtros" 
                icon="pi pi-check" 
                onClick={aplicarFiltros}
                loading={loading.viajes}
              />
            </div>
          </div>
        </Dialog>

        {/* Diálogo de Exportación */}
        <Dialog
          visible={exportDialog}
          onHide={() => setExportDialog(false)}
          header="Exportar Estimación"
          style={{ width: '750px' }}
          footer={
            <div>
              <Button
                label="Cancelar"
                icon="pi pi-times"
                onClick={() => setExportDialog(false)}
                className="p-button-text"
                disabled={loading.viajes}
              />
              <Button
                label="Exportar"
                icon="pi pi-download"
                onClick={exportarAExcel}
                loading={loading.viajes}
              />
            </div>
          }
        >
          <div className="p-3 surface-100 border-round mb-4">
            <strong>Resumen de la estimación:</strong>
            <ul className="mt-2 mb-0">
              <li><strong>Cliente:</strong> {clienteSeleccionado?.cliente_nombre}</li>
              <li><strong>Tipo:</strong> {tipoVista === 'camion' ? 'Camión' : 'Maquinaria'}</li>
              <li><strong>Obra:</strong> {clienteSeleccionado?.obra || 'No especificada'}</li>
              {tipoVista === 'camion' ? (
                <>
                  <li><strong>Viajes:</strong> {totalViajes}</li>
                  <li><strong>Total M3:</strong> {totalM3.toFixed(2)}</li>
                  <li><strong>Total a Cobrar:</strong> {formatCurrency(totalCobrar)}</li>
                </>
              ) : (
                <>
                  <li><strong>Rentas:</strong> {totalRentas}</li>
                  <li><strong>Total Hrs:</strong> {totalHrsMaquinaria.toFixed(2)}</li>
                  <li><strong>Total a Cobrar:</strong> {formatCurrency(totalCobrarMaquinaria)}</li>
                </>
              )}
              {tipoVista === 'camion' && filtros.fechaInicio && filtros.fechaFin && (
                <li>
                  <strong>Rango de fechas:</strong> {filtros.fechaInicio.toLocaleDateString('es-MX')} - {filtros.fechaFin.toLocaleDateString('es-MX')}
                </li>
              )}
            </ul>
          </div>

          <Divider />

          {tipoVista === 'maquinaria' && (
            <p className="text-color-secondary">
              La renta de maquinaria se exporta en una sola hoja estándar (Fecha, Estimación, Folio, Máquina, Operador, Hrs, Precio, Total y Observaciones), con subtotal, IVA y total.
            </p>
          )}

          {tipoVista === 'camion' && (
          <>
          <div className="field">
            <label className="font-medium">¿Cómo quieres exportar la información?</label>
            <div className="flex gap-4 mt-2">
              <div className="flex align-items-center">
                <RadioButton
                  inputId="modoEstandar"
                  name="modoExportacion"
                  value="estandar"
                  checked={modoExportacion === 'estandar'}
                  onChange={() => {
                    setModoExportacion('estandar');
                    aplicarConfiguracionGuardada(null);
                  }}
                />
                <label htmlFor="modoEstandar" className="ml-2">Formato estándar</label>
              </div>
              <div className="flex align-items-center">
                <RadioButton
                  inputId="modoPersonalizado"
                  name="modoExportacion"
                  value="personalizado"
                  checked={modoExportacion === 'personalizado'}
                  onChange={() => setModoExportacion('personalizado')}
                />
                <label htmlFor="modoPersonalizado" className="ml-2">Personalizar columnas y hojas</label>
              </div>
            </div>
          </div>

          {modoExportacion === 'personalizado' && (
            <div className="mt-4">
              <div className="field">
                <label className="font-medium">Configuración guardada</label>
                <div className="flex gap-2 align-items-center mt-2">
                  <Dropdown
                    value={configSeleccionadaId}
                    onChange={(e) => aplicarConfiguracionGuardada(e.value)}
                    options={[
                      { label: 'Personalizado (sin guardar)', value: null },
                      ...configuraciones.map(c => ({ label: c.nombre, value: c.id }))
                    ]}
                    placeholder="Selecciona una configuración guardada"
                    className="flex-1"
                  />
                  <Button
                    icon="pi pi-save"
                    className="p-button-outlined"
                    tooltip="Guardar esta configuración con un nombre"
                    onClick={() => setGuardarConfigDialog(true)}
                    disabled={columnasSeleccionadas.length === 0}
                  />
                  <Button
                    icon="pi pi-trash"
                    className="p-button-outlined p-button-danger"
                    tooltip="Eliminar la configuración seleccionada"
                    onClick={eliminarConfigSeleccionada}
                    disabled={configSeleccionadaId === null}
                  />
                </div>
              </div>

              <div className="field mt-3">
                <label className="font-medium">Hojas a incluir en el archivo</label>
                <div className="flex flex-column gap-2 mt-2">
                  <div className="flex align-items-center">
                    <Checkbox inputId="chkResumen" checked={incluirResumen} onChange={(e) => setIncluirResumen(!!e.checked)} />
                    <label htmlFor="chkResumen" className="ml-2">Resumen (hoja tipo estimación con logo y totales)</label>
                  </div>
                  <div className="flex align-items-center">
                    <Checkbox inputId="chkDetalle" checked={incluirDetalle} onChange={(e) => setIncluirDetalle(!!e.checked)} />
                    <label htmlFor="chkDetalle" className="ml-2">Viajes Detallados (listado de viajes, columnas personalizables)</label>
                  </div>
                  <div className="flex align-items-center">
                    <Checkbox inputId="chkResumenMat" checked={incluirResumenPorMaterial} onChange={(e) => setIncluirResumenPorMaterial(!!e.checked)} />
                    <label htmlFor="chkResumenMat" className="ml-2">Resumen por Material</label>
                  </div>
                </div>
              </div>

              {incluirDetalle && (
                <div className="field mt-3">
                  <label className="font-medium">Columnas de &quot;Viajes Detallados&quot; (elige y ordena con las flechas)</label>
                  <PickList
                    dataKey="key"
                    source={columnasDisponibles}
                    target={columnasSeleccionadas}
                    onChange={(e) => {
                      setColumnasDisponibles(e.source);
                      setColumnasSeleccionadas(e.target);
                    }}
                    itemTemplate={(item: ColumnaExportacion) => <span>{item.label}</span>}
                    sourceHeader="Disponibles"
                    targetHeader="A exportar (en este orden)"
                    sourceStyle={{ height: '220px' }}
                    targetStyle={{ height: '220px' }}
                  />
                </div>
              )}
            </div>
          )}
          </>
          )}
        </Dialog>

        {/* Diálogo para guardar configuración de exportación */}
        <Dialog
          visible={guardarConfigDialog}
          onHide={() => setGuardarConfigDialog(false)}
          header="Guardar configuración de exportación"
          style={{ width: '450px' }}
          footer={
            <div>
              <Button
                label="Cancelar"
                icon="pi pi-times"
                className="p-button-text"
                onClick={() => setGuardarConfigDialog(false)}
                disabled={guardandoConfig}
              />
              <Button
                label="Guardar"
                icon="pi pi-save"
                onClick={guardarConfigActual}
                loading={guardandoConfig}
              />
            </div>
          }
        >
          <div className="field">
            <label htmlFor="nombreConfig">Nombre de la configuración</label>
            <InputText
              id="nombreConfig"
              value={nombreNuevaConfig}
              onChange={(e) => setNombreNuevaConfig(e.target.value)}
              placeholder="Ej. Exportación CEMEX"
              className="w-full"
              autoFocus
            />
          </div>
        </Dialog>

        {/* Diálogo para cambiar el estatus de los viajes seleccionados */}
        <Dialog
          visible={cambiarEstatusDialog}
          onHide={cerrarCambiarEstatus}
          header="Cambiar Estatus"
          style={{ width: '420px' }}
          footer={
            <div>
              <Button
                label="Cancelar"
                icon="pi pi-times"
                className="p-button-text"
                onClick={cerrarCambiarEstatus}
                disabled={guardandoEstatus}
              />
              <Button
                label="Guardar"
                icon="pi pi-check"
                onClick={guardarCambioEstatus}
                loading={guardandoEstatus}
                disabled={!nuevoEstatus}
              />
            </div>
          }
        >
          <p className="mt-0">
            Se actualizará el estatus de <strong>{viajesSeleccionados.length}</strong> viaje(s) seleccionado(s).
          </p>
          <div className="field">
            <label htmlFor="nuevoEstatus">Nuevo estatus</label>
            <Dropdown
              id="nuevoEstatus"
              value={nuevoEstatus}
              onChange={(e) => setNuevoEstatus(e.value)}
              options={OPCIONES_ESTATUS}
              placeholder="Selecciona un estatus"
              className="w-full"
            />
          </div>
        </Dialog>

        {/* Diálogo: Subir Excel para cambiar estatus en lote */}
        <Dialog
          visible={subirExcelDialog}
          onHide={cerrarSubirExcel}
          header="Subir Excel: Cambiar Estatus"
          style={{ width: '90vw', maxWidth: '1100px' }}
          footer={
            <div>
              <Button label="Cancelar" icon="pi pi-times" text onClick={cerrarSubirExcel} disabled={guardandoSubida} />
              <Button
                label={`Guardar ${filasAActualizar.length} fila(s)`}
                icon="pi pi-check"
                onClick={guardarSubidaEstatus}
                loading={guardandoSubida}
                disabled={!estatusDestinoSubida || filasAActualizar.length === 0}
              />
            </div>
          }
        >
          <div className="field">
            <label htmlFor="estatusDestinoSubida" className="font-medium">Estatus al que pasarán los viajes</label>
            <Dropdown
              id="estatusDestinoSubida"
              value={estatusDestinoSubida}
              onChange={(e) => setEstatusDestinoSubida(e.value)}
              options={OPCIONES_ESTATUS}
              placeholder="Selecciona un estatus"
              className="w-full"
            />
          </div>

          <p className="text-color-secondary mt-2 mb-3">
            Sube el Excel exportado (hoja &quot;Viajes Detallados&quot;, con columnas Folio y/o Folio BCO). Por cada fila: si trae{' '}
            <strong>Folio BCO</strong> se busca por ese dato; si no, se busca por <strong>Folio</strong>. Solo se actualizan los viajes que
            hoy están en estatus <Tag severity="info" value="estimado" />. Los que no tienen estatus quedan marcados para que confirmes uno
            por uno si quieres incluirlos.
          </p>

          <FileUpload
            name="subirExcelEstatus"
            accept=".xlsx,.xls"
            maxFileSize={10000000}
            customUpload
            uploadHandler={manejarArchivoSubido}
            chooseLabel={nombreArchivoSubido || 'Seleccionar Excel'}
            mode="basic"
            auto
            disabled={!estatusDestinoSubida || procesandoSubida || guardandoSubida}
          />
          {!estatusDestinoSubida && <small className="block mt-2 text-orange-500">Selecciona primero el estatus destino.</small>}

          {procesandoSubida && (
            <div className="flex justify-content-center mt-4">
              <ProgressSpinner style={{ width: '40px', height: '40px' }} />
            </div>
          )}

          {!procesandoSubida && filasSubidas.length > 0 && (
            <DataTable value={filasSubidas} className="mt-4 p-datatable-sm" scrollable scrollHeight="400px" showGridlines dataKey="fila">
              <Column header="Fila" body={(f: FilaSubidaEstatus) => f.fila} style={{ width: '60px' }} />
              <Column header="Folio BCO" body={(f: FilaSubidaEstatus) => f.folioBco || '-'} />
              <Column header="Folio" body={(f: FilaSubidaEstatus) => f.folio || '-'} />
              <Column header="Estatus actual" body={(f: FilaSubidaEstatus) => f.viaje?.estatus || '-'} style={{ width: '130px' }} />
              <Column
                header="Situación"
                body={(f: FilaSubidaEstatus) => <Tag severity={SEVERIDAD_CLASIFICACION[f.clasificacion]} value={ETIQUETA_CLASIFICACION[f.clasificacion]} />}
                style={{ width: '260px' }}
              />
              <Column
                header="Incluir"
                body={(f: FilaSubidaEstatus) =>
                  f.clasificacion === 'confirmar' || f.clasificacion === 'actualizara' ? (
                    <Checkbox checked={f.incluir} disabled={f.clasificacion === 'actualizara'} onChange={() => alternarIncluirFila(f.fila)} />
                  ) : (
                    '-'
                  )
                }
                style={{ width: '80px' }}
              />
            </DataTable>
          )}
        </Dialog>
      </div>
    </div>
  );
};

export default EstimacionesCrud;