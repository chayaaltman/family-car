import React, { createContext, useContext, useMemo, useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookingDetails } from './screens/BookingDetails';
import { BookingForm, type BookingFormInit } from './screens/BookingForm';
import { CarEditor } from './screens/CarEditor';
import { MemberEditor } from './screens/MemberEditor';
import { colors } from './theme';

/**
 * The app has four tabs plus a few "sheets" that slide up over them.
 * This context lets any screen open a sheet without prop drilling.
 */
type Sheet =
  | { kind: 'new-booking'; init: BookingFormInit }
  | { kind: 'booking'; bookingId: string }
  | { kind: 'car'; carId?: string }
  | { kind: 'member'; memberId?: string };

interface SheetApi {
  newBooking: (init?: BookingFormInit) => void;
  showBooking: (bookingId: string) => void;
  editCar: (carId?: string) => void;
  editMember: (memberId?: string) => void;
}

const SheetContext = createContext<SheetApi | null>(null);

export function SheetProvider({ children }: { children: React.ReactNode }) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const close = () => setSheet(null);

  const api = useMemo<SheetApi>(
    () => ({
      newBooking: (init = {}) => setSheet({ kind: 'new-booking', init }),
      showBooking: (bookingId) => setSheet({ kind: 'booking', bookingId }),
      editCar: (carId) => setSheet({ kind: 'car', carId }),
      editMember: (memberId) => setSheet({ kind: 'member', memberId }),
    }),
    [],
  );

  return (
    <SheetContext.Provider value={api}>
      {children}
      <Modal
        visible={sheet !== null}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
        onRequestClose={close}
      >
        <SafeAreaView style={s.sheet} edges={Platform.OS === 'ios' ? ['bottom'] : ['top', 'bottom']}>
          <View style={s.inner}>
            {sheet?.kind === 'new-booking' && <BookingForm init={sheet.init} onDone={close} />}
            {sheet?.kind === 'booking' && (
              <BookingDetails
                bookingId={sheet.bookingId}
                onClose={close}
                onEdit={() => setSheet({ kind: 'new-booking', init: { bookingId: sheet.bookingId } })}
              />
            )}
            {sheet?.kind === 'car' && <CarEditor carId={sheet.carId} onDone={close} />}
            {sheet?.kind === 'member' && <MemberEditor memberId={sheet.memberId} onDone={close} />}
          </View>
        </SafeAreaView>
      </Modal>
    </SheetContext.Provider>
  );
}

export function useSheets(): SheetApi {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error('useSheets must be used inside <SheetProvider>');
  return ctx;
}

const s = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.bg },
  // Keeps forms a comfortable width on tablets and desktop browsers.
  inner: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center' },
});
