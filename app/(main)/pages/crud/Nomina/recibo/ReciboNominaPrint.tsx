"use client";

import React, { forwardRef } from 'react';

interface ReciboNominaProps {
  nomina: any;
}

export const ReciboNominaPrint = forwardRef<HTMLDivElement, ReciboNominaProps>(({ nomina }, ref) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  // Calcular valores usando los datos reales de la nómina
  const pagoAlcanceMeta = nomina.pago_alcance_meta || 0;
  const bono = nomina.bono || 0;
  const pagoBruto = nomina.pago_bruto || (pagoAlcanceMeta + bono);
  
  // Descuentos
  const descuentoInfonavit = nomina.descuento_infonavit || 0;
  const descuentoFonacot = nomina.descuento_fonacot || 0;
  const otrosDescuentos = nomina.otros_descuentos || 0;
  const descuentoPrestamo = nomina.prestamos || 0;
  const descuentoAdministrativo = nomina.descuento_administrativo || 0;
  
  // Total de descuentos
  const totalDescuentos = descuentoInfonavit + descuentoFonacot + otrosDescuentos + descuentoPrestamo + descuentoAdministrativo;
  
  // Pago neto (ya viene calculado en la nómina, pero lo recalculamos para estar seguros)
  const netTotal = nomina.pago_neto || (pagoBruto - totalDescuentos);

  // Función para formatear el rango de fechas
  const formatDateRange = () => {
    if (!nomina.fecha_inicio || !nomina.fecha_fin) return "Fecha no disponible";
    
    try {
      const [yearInicio, monthInicio, dayInicio] = nomina.fecha_inicio.split('-').map(Number);
      const [yearFin, monthFin, dayFin] = nomina.fecha_fin.split('-').map(Number);
      
      const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const mes = meses[monthInicio - 1];
      
      return `${dayInicio} AL ${dayFin} ${mes} ${yearInicio}`;
    } catch (error) {
      return "Fecha no disponible";
    }
  };

  // Función para formatear fecha larga (para la parte inferior)
  const formatDateLong = () => {
    try {
      const fecha = new Date();
      return fecha.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      return new Date().toLocaleDateString('es-ES');
    }
  };

  return (
    <div 
      ref={ref} 
      className="recibo-print-container"
      style={{
        width: '100%',
        maxWidth: '850px',
        margin: '0 auto',
        backgroundColor: 'white',
        padding: '25px 30px',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '13px',
        border: '1px solid #d1d5db',
        borderRadius: '6px'
      }}
    >
      {/* Encabezado con el nombre del empleado */}
      <div style={{ 
        textAlign: 'center', 
        marginBottom: '15px',
        borderBottom: '2px solid #000',
        paddingBottom: '8px'
      }}>
        <h2 style={{ 
          fontSize: '20px', 
          fontWeight: 'bold', 
          textTransform: 'uppercase',
          margin: 0,
          letterSpacing: '1px'
        }}>
          {nomina.empleado_nombre || "NOMBRE DEL EMPLEADO"}
        </h2>
      </div>

      {/* Contenido principal en dos columnas */}
      <div style={{ 
        display: 'flex', 
        gap: '30px',
        marginBottom: '15px'
      }}>
        {/* Columna izquierda - Texto legal */}
        <div style={{ 
          flex: '0 0 60%',
          fontSize: '12px',
          lineHeight: '1.5'
        }}>
          <p style={{ margin: '0 0 8px 0' }}>
            Este recibo es un comprobante que recibió de la empresa por la cantidad de
          </p>
          <p style={{ 
            margin: '0 0 8px 0',
            fontSize: '22px',
            fontWeight: 'bold',
            color: '#1a1a1a'
          }}>
            {formatCurrency(netTotal)}
          </p>
          <p style={{ margin: '0 0 8px 0' }}>
            como pago correspondiente a la reserva número {nomina.semana || "N/A"} de fecha
          </p>
          <p style={{ 
            margin: '0 0 8px 0',
            fontWeight: '600'
          }}>
            {formatDateRange()}
          </p>
          <p style={{ margin: '8px 0 0 0' }}>
            a continuación por las partes que se contrataron, por lo que con el cumplimiento
            del pago a mi persona, no existe cantidad y reclamación alguna que quiera
            realizar a la empresa.
          </p>
          
          {/* Firma */}
          <div style={{ 
            marginTop: '20px',
            borderTop: '1px solid #000',
            paddingTop: '5px',
            width: '80%'
          }}>
            <p style={{ 
              fontWeight: 'bold', 
              textTransform: 'uppercase',
              fontSize: '13px',
              margin: 0
            }}>
              {nomina.empleado_nombre || "NOMBRE DEL EMPLEADO"}
            </p>
          </div>
        </div>

        {/* Columna derecha - Detalles de pago */}
        <div style={{ 
          flex: '1',
          borderLeft: '2px solid #000',
          paddingLeft: '20px'
        }}>
          {/* Detalles de nómina */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              padding: '3px 0',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <span style={{ fontWeight: 'bold' }}>NOMINA</span>
              <span style={{ fontWeight: 'bold' }}>{formatCurrency(pagoBruto)}</span>
            </div>
            
            {/* Pago por alcance de meta */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              padding: '3px 0',
              fontSize: '11px',
              color: '#4b5563'
            }}>
              <span>Pago Bruto</span>
              <span>{formatCurrency(pagoAlcanceMeta)}</span>
            </div>
            
            {/* Bono si tiene */}
            {bono > 0 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                padding: '3px 0',
                fontSize: '11px',
                color: '#4b5563'
              }}>
                <span>Bono</span>
                <span>{formatCurrency(bono)}</span>
              </div>
            )}
            
            {/* Línea separadora */}
            <div style={{ 
              borderTop: '1px dashed #d1d5db',
              margin: '4px 0'
            }}></div>
            
            {/* DESCUENTOS */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              padding: '3px 0',
              color: '#4b5563'
            }}>
              <span style={{ fontWeight: 'bold' }}>DESCUENTOS</span>
              <span style={{ fontWeight: 'bold' }}>{formatCurrency(totalDescuentos)}</span>
            </div>
            
            {/* Infonavit */}
            {descuentoInfonavit > 0 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                padding: '2px 0',
                fontSize: '11px',
                color: '#4b5563'
              }}>
                <span>Infonavit</span>
                <span>{formatCurrency(descuentoInfonavit)}</span>
              </div>
            )}
            
            {/* Fonacot */}
            {descuentoFonacot > 0 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                padding: '2px 0',
                fontSize: '11px',
                color: '#4b5563'
              }}>
                <span>Fonacot</span>
                <span>{formatCurrency(descuentoFonacot)}</span>
              </div>
            )}
            
            {/* Otros descuentos */}
            {otrosDescuentos > 0 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                padding: '2px 0',
                fontSize: '11px',
                color: '#4b5563'
              }}>
                <span>Otros Descuentos</span>
                <span>{formatCurrency(otrosDescuentos)}</span>
              </div>
            )}
            
            {/* Préstamo */}
            {descuentoPrestamo > 0 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                padding: '2px 0',
                fontSize: '11px',
                color: '#4b5563'
              }}>
                <span>Préstamo</span>
                <span>{formatCurrency(descuentoPrestamo)}</span>
              </div>
            )}
            
            {/* Descuento administrativo */}
            {descuentoAdministrativo > 0 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                padding: '2px 0',
                fontSize: '11px',
                color: '#4b5563'
              }}>
                <span>Desc. Administrativo</span>
                <span>{formatCurrency(descuentoAdministrativo)}</span>
              </div>
            )}
            
            {/* Línea separadora */}
            <div style={{ 
              borderTop: '1px dashed #d1d5db',
              margin: '4px 0'
            }}></div>
            
            {/* TOTAL NETO */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              padding: '5px 0',
              borderTop: '2px solid #000',
              marginTop: '2px'
            }}>
              <span style={{ fontWeight: 'bold', fontSize: '14px' }}>TOTAL NETO</span>
              <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#4b5563' }}>
                {formatCurrency(netTotal)}
              </span>
            </div>
          </div>

          {/* Número de semana y fecha */}
          <div style={{ 
            borderTop: '1px solid #d1d5db',
            paddingTop: '8px',
            marginTop: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
              {nomina.semana || "N/A"}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>
              {formatDateLong()}
            </div>
          </div>
        </div>
      </div>

      {/* Fecha en la parte inferior */}
      <div style={{ 
        textAlign: 'center',
        fontSize: '11px',
        color: '#6b7280',
        borderTop: '1px solid #e5e7eb',
        paddingTop: '8px',
        marginTop: '5px'
      }}>
        Documento generado electrónicamente
      </div>
    </div>
  );
});

ReciboNominaPrint.displayName = "ReciboNominaPrint";