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
import * as XLSX from 'xlsx';
import {
  fetchClientesConViajesUltraRapido as fetchClientesConViajes,
  fetchViajesConFiltrosOptimizado as fetchViajesConFiltros,
  exportarEstimacionExcel,
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

type ColumnaExportacion = { key: string; label: string };

const EstimacionesCrud = () => { 
  const [clientes, setClientes] = useState<EstimacionCliente[]>([]); 
  const [clienteSeleccionado, setClienteSeleccionado] = useState<EstimacionCliente | null>(null); 
  const [viajesFiltrados, setViajesFiltrados] = useState<ViajeEstimacion[]>([]); 
  const [viajeSeleccionado, setViajeSeleccionado] = useState<ViajeEstimacion | null>(null);
  const [loading, setLoading] = useState({ clientes: true, viajes: false, opciones: false }); 
  const [filtros, setFiltros] = useState<FiltrosEstimacion>({
    fechaInicio: null,
    fechaFin: null,
    clienteId: null,
    operador: null,
    material: null,
    origen: null,
    destino: null
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

  const aplicarFiltros = async () => {
    if (!clienteSeleccionado) {
      mostrarError('Selecciona un cliente primero');
      return;
    }

    setLoading(prev => ({...prev, viajes: true}));
    try {
      const viajes = await fetchViajesConFiltros({
        ...filtros,
        clienteId: clienteSeleccionado.id_cliente
      });
      setViajesFiltrados(viajes);
      setShowFiltros(false);
      mostrarExito(`Filtros aplicados: ${viajes.length} viajes encontrados`);
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
      destino: null
    });
    if (clienteSeleccionado) {
      // Recargar todos los viajes del cliente
      cargarViajesCliente(clienteSeleccionado);
    } else {
      setViajesFiltrados([]);
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
        destino: null
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
      setViajeSeleccionado(null);
      return; 
    } 
    
    setClienteSeleccionado(cliente); 
    setViajeSeleccionado(null);
    await cargarViajesCliente(cliente);
  };

  const handleViajeClick = (viaje: ViajeEstimacion) => {
    if (viajeSeleccionado?.id === viaje.id) {
      setViajeSeleccionado(null);
      return;
    }
    setViajeSeleccionado(viaje);
    // Aquí puedes agregar más lógica si necesitas mostrar detalles del viaje
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

  // Función para exportar a Excel
  const exportarAExcel = async () => {
    if (!clienteSeleccionado || viajesFiltrados.length === 0) {
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

  // Calcular totales
  const totalViajes = viajesFiltrados.length;
  const totalM3 = viajesFiltrados.reduce((sum, viaje) => sum + viaje.m3, 0);
  const totalCobrar = viajesFiltrados.reduce((sum, viaje) => sum + viaje.total_viaje, 0);
  const totalHorasRenta = viajesFiltrados.reduce((sum, viaje) => sum + (viaje.horas_renta || 0), 0);

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
                    <div className="flex justify-content-between align-items-center">
                      <span>
                        Fecha de estimación: {new Date().toLocaleDateString('es-MX')}
                      </span>
                      <div className="flex gap-2">
                        <Button 
                          icon="pi pi-filter" 
                          label="Filtrar" 
                          className="p-button-outlined"
                          onClick={() => setShowFiltros(true)}
                          disabled={loading.viajes}
                        />
                        <Button 
                          icon="pi pi-download"
                          label="Exportar Excel"
                          className="p-button-success"
                          onClick={abrirDialogoExportacion}
                          disabled={viajesFiltrados.length === 0 || loading.viajes}
                        />
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
                      <strong>Total Viajes:</strong> {totalViajes}
                    </div>
                  </div>

                  {/* Resumen de la estimación */}
                  <div className="grid mb-4">
                    <div className="col-12 md:col-6">
                      <Card className="bg-blue-50">
                        <div className="flex justify-content-between">
                          <span>Total M3:</span>
                          <strong>{totalM3.toFixed(2)} m³</strong>
                        </div>
                      </Card>
                    </div>
                    <div className="col-12 md:col-6">
                      <Card className="bg-green-50">
                        <div className="flex justify-content-between">
                          <span>Total a Cobrar:</span>
                          <strong>{formatCurrency(totalCobrar)}</strong>
                        </div>
                      </Card>
                    </div>
                  </div>

                  {loading.viajes ? ( 
                    <div className="flex justify-content-center"> 
                      <ProgressSpinner /> 
                    </div> 
                  ) : ( 
                    <DataTable 
                      value={viajesFiltrados} 
                      paginator
                      rows={10}
                      rowsPerPageOptions={[5, 10, 25, 50]}
                      emptyMessage="No se encontraron viajes con los filtros aplicados" 
                      className="p-datatable-sm" 
                      showGridlines
                      selectionMode="single"
                      selection={viajeSeleccionado}
                      onSelectionChange={(e) => handleViajeClick(e.value as ViajeEstimacion)}
                      dataKey="id"
                    > 
                      <Column selectionMode="single" headerStyle={{ width: '3rem' }} />
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
                        field="total_viaje" 
                        header="Total Viaje" 
                        body={(row) => (
                          <strong className="text-green-600">{formatCurrency(row.total_viaje)}</strong>
                        )} 
                        style={{ width: '130px' }}
                      /> 
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
          header="Filtrar Viajes" 
          style={{ width: '500px' }}
        >
          <div className="p-fluid">
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
              <li><strong>Obra:</strong> {clienteSeleccionado?.obra || 'No especificada'}</li>
              <li><strong>Viajes:</strong> {totalViajes}</li>
              <li><strong>Total M3:</strong> {totalM3.toFixed(2)}</li>
              <li><strong>Total a Cobrar:</strong> {formatCurrency(totalCobrar)}</li>
              {filtros.fechaInicio && filtros.fechaFin && (
                <li>
                  <strong>Rango de fechas:</strong> {filtros.fechaInicio.toLocaleDateString('es-MX')} - {filtros.fechaFin.toLocaleDateString('es-MX')}
                </li>
              )}
            </ul>
          </div>

          <Divider />

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
      </div>
    </div>
  );
};

export default EstimacionesCrud;