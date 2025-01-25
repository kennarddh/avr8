#include <avr/io.h>
#define io(reg) _SFR_IO_ADDR(reg)

.global main

main:
    sbi io(DDRB), 5  ; set PB5 as output
    sbi io(PINB), 5  ; toggle PB5

_end:
    rjmp _end ; hang forever