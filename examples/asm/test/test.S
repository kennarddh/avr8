#include <avr/io.h>
#define io(reg) _SFR_IO_ADDR(reg)

.global main

main:
	ldi r24, 255
	ldi r25, 255
	sbiw r24, 63

_end:
    rjmp _end ; hang forever