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
import * as XLSX from 'xlsx';
import { 
  fetchClientesConViajesUltraRapido as fetchClientesConViajes, 
  fetchViajesConFiltrosOptimizado as fetchViajesConFiltros,
  exportarEstimacionExcel, 
  fetchOpcionesFiltros, 
  EstimacionCliente, 
  ViajeEstimacion, 
  FiltrosEstimacion 
} from '../../../../../Services/BD/estimacionesService';

const EstimacionesCrud = () => { 
  const [clientes, setClientes] = useState<EstimacionCliente[]>([]); 
  const [clienteSeleccionado, setClienteSeleccionado] = useState<EstimacionCliente | null>(null); 
  const [viajesFiltrados, setViajesFiltrados] = useState<ViajeEstimacion[]>([]); 
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
    cargarDatosIniciales(); 
  }, []); 

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
      limpiarFiltros();
      return; 
    } 
    
    setClienteSeleccionado(cliente); 
    await cargarViajesCliente(cliente);
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
        // logoBase64 // FALTA POR DEFINIR SI SE USA O NO
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
            <div className="grid"> 
              {clientes.map(cliente => ( 
                <div className="col-12 md:col-6 lg:col-4" key={cliente.id_cliente}> 
                  <Card 
                    className={`cursor-pointer transition-all transition-duration-200 ${
                      clienteSeleccionado?.id_cliente === cliente.id_cliente 
                        ? 'border-left-3 border-primary shadow-2' 
                        : 'border-left-3 border-white shadow-1'
                    }`} 
                    onClick={() => handleClienteClick(cliente)} 
                  > 
                    <div className="flex flex-column gap-3"> 
                      <div className="flex justify-content-between align-items-start"> 
                        <span className="font-medium text-900" style={{ fontSize: '1.1rem' }}> 
                          {cliente.cliente_nombre} 
                        </span> 
                        <Tag 
                          value={`${cliente.total_viajes} viajes`} 
                          severity="info" 
                          className="scale-90" 
                          rounded 
                        /> 
                      </div> 
                      
                      <Divider className="my-1 mx-0" /> 
                      
                      <div className="grid"> 
                        {/* <div className="col-6 flex flex-column"> 
                          <span className="text-sm text-600 mb-1">Total M3</span> 
                          <span className="font-medium text-900"> 
                            {cliente.total_m3.toFixed(2)} m³
                          </span> 
                        </div>  */}
                        <div className="col-6 flex flex-column"> 
                          <span className="text-sm text-600 mb-1">Total a Cobrar</span> 
                          <span className="font-medium text-green-600"> 
                            {formatCurrency(cliente.total_cobrar)} 
                          </span> 
                        </div> 
                        {cliente.obra && (
                          <div className="col-12 mt-2">
                            <span className="text-sm text-600">Obra: </span>
                            <span className="text-sm font-medium">{cliente.obra}</span>
                          </div>
                        )}
                      </div> 
                    </div> 
                  </Card> 
                </div> 
              ))} 
            </div> 

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
                          onClick={() => setExportDialog(true)}
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
                    > 
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
          <p>¿Estás seguro de que quieres exportar la estimación a Excel?</p>
          <div className="mt-3 p-3 surface-100 border-round">
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
        </Dialog>
      </div> 
    </div> 
  ); 
}; 

export default EstimacionesCrud;