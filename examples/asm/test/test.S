#include <avr/io.h>
#define io(reg) _SFR_IO_ADDR(reg)

.global main

main:
	ldi r24, 254
	adiw r24, 63

_end:
    rjmp _end ; hang forever