#include <avr/io.h>
#define io(reg) _SFR_IO_ADDR(reg)

    sbi io(DDRB), 5  ; set PB5 as output
loop:
    sbi io(PINB), 5  ; toggle PB5
    ldi r26, 2       ; delay
delay:
    subi r26, 1
    brne delay
    rjmp loop