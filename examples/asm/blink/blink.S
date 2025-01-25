#include <avr/io.h>
#define io(reg) _SFR_IO_ADDR(reg)

    sbi io(DDRB), 5  ; set PB5 as output
loop:
    sbi io(PINB), 5  ; toggle PB5
    ldi r26, 49      ; delay for 49 * 2^16 * 5 cycles
delay:
    sbiw r24, 1
    sbci r26, 0
    brne delay
    rjmp loop