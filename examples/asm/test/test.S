#include <avr/io.h>
#define io(reg) _SFR_IO_ADDR(reg)

.global main

main:
	ldi r16, -60
	ldi r17, 100
	mulsu r16, r17

_end:
    rjmp _end ; hang forever