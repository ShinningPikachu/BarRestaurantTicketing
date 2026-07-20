import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { PrinterDiagnostics, PrinterStatus } from '../services/api';
import { colors } from '../theme';

export interface PrinterStatusPanelProps {
  status: PrinterStatus | null;
  diagnostics: PrinterDiagnostics | null;
  action: 'refresh' | 'reconnect' | 'test' | 'cancel' | 'diagnostics' | null;
  onRefresh: () => void;
  onReconnect: () => void;
  onTestPrint: () => void;
  onCancelPending: () => void;
  onOpenDiagnostics: () => void;
}

const stateLabels: Record<PrinterStatus['state'], string> = {
  connected: 'Conectada',
  disconnected: 'Desconectada',
  unavailable: 'No disponible',
  busy: 'Ocupada',
  out_of_paper: 'Sin papel',
  error: 'Error',
  unknown: 'Estado desconocido',
};

const connectionLabels: Record<string, string> = {
  system: 'Impresora del sistema',
  network: 'Red ESC/POS',
  usb: 'USB ESC/POS',
  bluetooth: 'Bluetooth ESC/POS',
  none: 'Sin configurar',
};

function dateLabel(value: string | null): string {
  if (!value) return 'Nunca';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Desconocida' : date.toLocaleString('es-ES');
}

function statusColor(state: PrinterStatus['state']): string {
  if (state === 'connected') return colors.success;
  if (state === 'busy' || state === 'unknown') return colors.warning;
  return colors.error;
}

function ActionButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }): React.JSX.Element {
  return (
    <TouchableOpacity style={[styles.actionButton, disabled ? styles.actionButtonDisabled : null]} disabled={disabled} onPress={onPress}>
      <Text style={[styles.actionText, disabled ? styles.actionTextDisabled : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function PrinterStatusPanel(props: PrinterStatusPanelProps): React.JSX.Element {
  const status = props.status;
  const actionPending = props.action !== null;
  const canTest = status?.state === 'connected' && !status.queue.active && status.queue.pending === 0;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Estado de la impresora</Text>
          <Text style={styles.subtitle}>Los errores y diagnósticos nunca se envían como contenido imprimible.</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: status ? statusColor(status.state) : colors.warning }]}>
          <Text style={styles.badgeText}>{status ? stateLabels[status.state] : 'Consultando...'}</Text>
        </View>
      </View>

      <View style={styles.detailsGrid}>
        <View style={styles.detailCard}><Text style={styles.detailLabel}>Nombre</Text><Text style={styles.detailValue}>{status?.printerName ?? 'Desconocido'}</Text></View>
        <View style={styles.detailCard}><Text style={styles.detailLabel}>Conexión</Text><Text style={styles.detailValue}>{status ? (connectionLabels[status.connectionType] ?? status.connectionType) : 'Desconocida'}</Text></View>
        <View style={styles.detailCard}><Text style={styles.detailLabel}>Dirección / puerto</Text><Text style={styles.detailValue}>{status?.address ?? 'No aplicable'}</Text></View>
        <View style={styles.detailCard}><Text style={styles.detailLabel}>Formato</Text><Text style={styles.detailValue}>{status?.dataFormat === 'text' ? 'Texto mediante controlador' : 'ESC/POS directo'}</Text></View>
        <View style={styles.detailCard}><Text style={styles.detailLabel}>Última conexión correcta</Text><Text style={styles.detailValue}>{dateLabel(status?.lastSuccessfulConnectionAt ?? null)}</Text></View>
        <View style={styles.detailCard}><Text style={styles.detailLabel}>Última impresión aceptada</Text><Text style={styles.detailValue}>{dateLabel(status?.lastSuccessfulPrintAt ?? null)}</Text></View>
      </View>

      <View style={styles.queueCard}>
        <Text style={styles.sectionTitle}>Cola</Text>
        <Text style={styles.detailValue}>{status?.queue.active ? `Trabajo activo: ${status.queue.activeJobKind ?? 'impresión'}` : 'Sin trabajo activo'}</Text>
        <Text style={styles.detailValue}>{`${status?.queue.pending ?? 0} trabajos pendientes`}</Text>
        <Text style={styles.detailValue}>{status?.queue.external === null || status?.queue.external === undefined ? 'Cola externa no disponible' : `${status.queue.external} trabajos en la cola del sistema`}</Text>
      </View>

      {status?.error ? <View style={styles.errorCard}><Text style={styles.errorTitle}>Error</Text><Text style={styles.errorText}>{status.error}</Text></View> : null}

      <View style={styles.actions}>
        <ActionButton label={props.action === 'refresh' ? 'Actualizando...' : 'Actualizar estado'} disabled={actionPending} onPress={props.onRefresh} />
        <ActionButton label={props.action === 'reconnect' ? 'Reconectando...' : 'Reconectar'} disabled={actionPending} onPress={props.onReconnect} />
        <ActionButton label={props.action === 'test' ? 'Imprimiendo prueba...' : 'Impresión de prueba segura'} disabled={actionPending || !canTest} onPress={props.onTestPrint} />
        <ActionButton label={props.action === 'cancel' ? 'Cancelando...' : 'Cancelar pendientes'} disabled={actionPending || !status || status.queue.pending === 0} onPress={props.onCancelPending} />
        <ActionButton label={props.action === 'diagnostics' ? 'Abriendo...' : 'Abrir diagnósticos'} disabled={actionPending} onPress={props.onOpenDiagnostics} />
      </View>

      {status && !canTest ? <Text style={styles.helpText}>La prueba se habilita únicamente cuando la impresora está conectada y la cola está libre.</Text> : null}

      {props.diagnostics ? (
        <View style={styles.diagnosticsCard}>
          <Text style={styles.sectionTitle}>Diagnósticos</Text>
          <Text style={styles.detailValue}>{`Ancho: ${props.diagnostics.paperColumns} columnas · Corte: ${props.diagnostics.cutMode}`}</Text>
          <Text style={styles.detailValue}>{`Reintentos seguros: ${props.diagnostics.safeRetryLimit} · Límite de cola: ${props.diagnostics.queueLimit}`}</Text>
          <Text style={styles.helpText}>{props.diagnostics.note}</Text>
          <Text style={styles.diagnosticsHeading}>Trabajos recientes</Text>
          {props.diagnostics.recentJobs.length ? props.diagnostics.recentJobs.slice(0, 10).map((job) => (
            <View key={job.jobId} style={styles.jobRow}>
              <Text style={styles.jobTitle}>{`${job.kind} · ${job.state} · ${job.attempts} intento${job.attempts === 1 ? '' : 's'}`}</Text>
              <Text style={styles.helpText}>{dateLabel(job.completedAt)}</Text>
              {job.error ? <Text style={styles.errorText}>{job.error}</Text> : null}
            </View>
          )) : <Text style={styles.helpText}>No hay trabajos registrados en este proceso.</Text>}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { padding: 12, gap: 12 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  titleBlock: { flex: 1, minWidth: 220 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  badgeText: { color: colors.textLight, fontWeight: '700' },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailCard: { minWidth: 180, flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 10 },
  detailLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 3 },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  queueCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 10, gap: 3 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  errorCard: { borderWidth: 1, borderColor: colors.error, backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10 },
  errorTitle: { color: colors.error, fontWeight: '700', marginBottom: 3 },
  errorText: { color: colors.error, fontSize: 13 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionButton: { minHeight: 42, borderWidth: 1, borderColor: colors.borderDark, backgroundColor: colors.buttonSecondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, justifyContent: 'center' },
  actionButtonDisabled: { opacity: 0.5 },
  actionText: { color: colors.buttonSecondaryText, fontWeight: '700', fontSize: 13 },
  actionTextDisabled: { color: colors.textTertiary },
  helpText: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  diagnosticsCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 8, padding: 10, gap: 5 },
  diagnosticsHeading: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 6 },
  jobRow: { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 7, marginTop: 3 },
  jobTitle: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
