// Services/BD/operadorDocumentoService.ts
import { supabase } from '../superbase.service';

const BUCKET = 'documentos-empleados';

export interface OperadorDocumento {
    id?: number;
    operador_id: number;
    nombre_documento: string;
    nombre_archivo: string;
    storage_path: string;
    url: string;
    tamanio_kb?: number;
    fecha_carga?: string;
}

export const fetchDocumentosByOperador = async (operadorId: number): Promise<OperadorDocumento[]> => {
    const { data, error } = await supabase
        .from('operador_documento')
        .select('*')
        .eq('operador_id', operadorId)
        .order('fecha_carga', { ascending: false });

    if (error) {
        console.error('Error fetching documentos del operador:', error);
        throw error;
    }

    return data || [];
};

export const subirDocumentoOperador = async (
    operadorId: number,
    file: File,
    nombreDocumento: string
): Promise<OperadorDocumento> => {
    const nombreSanitizado = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${operadorId}/${Date.now()}_${nombreSanitizado}`;

    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { contentType: 'application/pdf' });

    if (uploadError) {
        console.error('Error subiendo documento a storage:', uploadError);
        throw uploadError;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    const { data, error } = await supabase
        .from('operador_documento')
        .insert([{
            operador_id: operadorId,
            nombre_documento: nombreDocumento.trim() || 'Documento',
            nombre_archivo: file.name,
            storage_path: storagePath,
            url: urlData.publicUrl,
            tamanio_kb: Math.round(file.size / 1024)
        }])
        .select()
        .single();

    if (error) {
        // Si falla el registro en BD, limpiamos el archivo ya subido para no dejar huérfanos
        await supabase.storage.from(BUCKET).remove([storagePath]);
        console.error('Error registrando documento del operador:', error);
        throw error;
    }

    return data;
};

export const eliminarDocumentoOperador = async (documento: OperadorDocumento): Promise<void> => {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([documento.storage_path]);
    if (storageError) {
        console.error('Error eliminando archivo del storage:', storageError);
    }

    const { error } = await supabase
        .from('operador_documento')
        .delete()
        .eq('id', documento.id);

    if (error) {
        console.error('Error eliminando documento del operador:', error);
        throw error;
    }
};
