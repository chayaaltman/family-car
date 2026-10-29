import React, { createContext, useContext, useMemo, useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookingDetails } from './screens/BookingDetails';
import { BookingForm, type BookingFormInit } from './screens/BookingForm';
import { CarDetails } from './screens/CarDetails';
import { CarEditor } from './screens/CarEditor';
import { MemberEditor } from './screens/MemberEditor';
import { MessageSheet, type MessageRequest } from './screens/MessageSheet';
import { colors } from './theme';

/**
 * The app has four tabs plus "sheets" that slide up over them (car page, booking
 * form, editors…). Sheets form a stack: opening one from another pushes it, and
 * closing returns to the one underneath — e.g. Car page → Edit → Save → back to the car page.
 */
type Sheet =
  | { kind: 'new-booking'; init: BookingFormInit }
  | { kind: 'booking'; bookingId: string }
  | { kind: 'car-details'; carId: string }
  | { kind: 'car'; carId?: string }
  | { kind: 'member'; memberId?: string }
  | { kind: 'message'; request: MessageRequest };

interface SheetApi {
  newBooking: (init?: BookingFormInit) => void;
  showBooking: (bookingId: string) => void;
  showCar: (carId: string) => void;
  editCar: (carId?: string) => void;
  editMember: (memberId?: string) => void;
  /** Replaces the current sheet (if any) with a "send a message" sheet. */
  message: (request: MessageRequest) => void;
  close: () => void;
}

const SheetContext = createContext<SheetApi | null>(null);

export function SheetProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<Sheet[]>([]);
  const top = stack[stack.length - 1];

  const api = useMemo<SheetApi>(() => {
    const push = (s: Sheet) => setStack((st) => [...st, s]);
    return {
      newBooking: (init = {}) => push({ kind: 'new-booking', init }),
      showBooking: (bookingId) => push({ kind: 'booking', bookingId }),
      showCar: (carId) => push({ kind: 'car-details', carId }),
      editCar: (carId) => push({ kind: 'car', carId }),
      editMember: (memberId) => push({ kind: 'member', memberId }),
      message: (request) => setStack((st) => [...st.slice(0, -1), { kind: 'message', request }]),
      close: () => setStack((st) => st.slice(0, -1)),
    };
  }, []);

  const close = api.close;

  return (
    <SheetContext.Provider value={api}>
      {children}
      <Modal
        visible={top !== undefined}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
        onRequestClose={close}
      >
        <SafeAreaView style={s.sheet} edges={Platform.OS === 'ios' ? ['bottom'] : ['top', 'bottom']}>
          {/* key forces a fresh screen when the stack changes, so form state never leaks between sheets */}
          <View style={s.inner} key={stack.length + (top?.kind ?? '')}>
            {top?.kind === 'new-booking' && <BookingForm init={top.init} onDone={close} />}
            {top?.kind === 'booking' && (
              <BookingDetails
                bookingId={top.bookingId}
                onClose={close}
                onEdit={() => api.newBooking({ bookingId: top.bookingId })}
              />
            )}
            {top?.kind === 'car-details' && <CarDetails carId={top.carId} onClose={close} />}
            {top?.kind === 'car' && <CarEditor carId={top.carId} onDone={close} />}
            {top?.kind === 'member' && <MemberEditor memberId={top.memberId} onDone={close} />}
            {top?.kind === 'message' && <MessageSheet request={top.request} onDone={close} />}
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
