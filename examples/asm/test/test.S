#include <avr/io.h>
#define io(reg) _SFR_IO_ADDR(reg)

.global main

main:
	ldi r24, 2
	ldi r25, 3
	neg r24

_end:
    rjmp _end ; hang forever