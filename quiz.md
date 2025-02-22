
::quiz
--select(difficulty="medium")
What is the **basic unit** of *information*?
- [ ] A number between 0 and 1
- [x] A yes/no decision
- [ ] A decimal digit
- [ ] A letter from the alphabet
=> Perfect! The basic unit of information is indeed a yes/no decision, which equals one bit. This is fundamental to all digital communication.
=< Think about the simplest possible way to represent information - what is the most basic choice that can be made?

--blank(difficulty="medium")
For a binary system with $V=1000$ possible signals, the decision content $G =$ ++ld(1000)++ $≈$ ++9.97 | 9,97++ bit. 
=> Very good! The calculation of decision content is important for coding messages. 
=< Think about the formula $G = ld(V)$ for decision content.

--match(difficulty="hard")
Match these **information theory concepts** with their *correct definitions*:
- Decision Content (G)
    - Number of yes/no decisions needed to identify a signal
- Designation Space (R)
    - Number of characters needed to select from the signal set
- Signal Set (V)
    - Total number of possible signal combinations
- Information Content (H)
    - Average information per character considering probabilities
=> Excellent! These fundamental concepts are key to understanding information theory.
=< Consider how each concept relates to the process of encoding and transmitting information.


--match(difficulty="easy")


--match(difficulty="easy")

| Here you write your Question!                                                                                                                           |                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| ![\|400](lectures/KT2025/01.Informationstheorie%20und%20Codierung/2.%20Informationstheorie%20-%202f92c636+/_assets/Pasted%20image%2020250216131116.png) | Counterpart 1  |
| ![\|400](lectures/KT2025/01.Informationstheorie%20und%20Codierung/2.%20Informationstheorie%20-%202f92c636+/_assets/Pasted%20image%2020250216132328.png) | Counter Part 2 |
| ![\|400](lectures/KT2025/01.Informationstheorie%20und%20Codierung/2.%20Informationstheorie%20-%202f92c636+/_assets/Pasted%20image%2020250216132915.png) | Counter Part 3 |




--select(difficulty="medium")
In a **number system** with base B, what is the relationship between the signal set V and the number of digits n?
- [ ] V = n × B
- [x] V = B^n
- [ ] V = B/n
- [ ] V = n/B
=> Correct! The formula V = B^n shows how the number of possible combinations grows exponentially with the number of digits.
=< Think about how many possibilities exist for each digit position.

--blank(difficulty="hard")
For a 4-digit decimal number, the designation space $R =$ ++40++ and the signal set $V =$ ++10000++. For a 10-digit binary number, $R =$ ++20++ and $V =$ ++1024++.
=> Excellent! You understand how to calculate designation space and signal set size for different number systems.
=< Remember the formulas $R = n × B$ and $V = B^n$.

--select(difficulty="hard")
What is the **optimal base** $B$ for a number system to minimize the designation space $R$?
- [ ] 2 (binary)
- [ ] 3 (ternary)
- [x] e (≈ 2.71828)
- [ ] 10 (decimal)
=> Perfect! While e is mathematically optimal, binary $(B=2)$ is more practical for technical implementation.
=< Consider why we use binary despite it not being mathematically optimal.

--choose(options="Designation Space | Signal Set | Information Content | Base")
The ++Designation Space++ $R$ for base $B$ and signal set $V$ is calculated as $R = B × log_B(V)$.
=> Correct! This formula is fundamental for calculating the required number of characters.
=< Think about how this relates to the efficiency of different number systems.

--select(difficulty="medium")
What happens to the **information content** H of a signal when its probability p increases?
- [ ] It stays the same
- [ ] It increases linearly
- [x] It decreases
- [ ] It increases exponentially
=> Excellent! More frequent signals carry less information because they are more predictable.
=< Consider why rare events are more informative than common ones.

--blank(difficulty="hard")
For signals a, b, c occurring with probabilities p(a)=0.5, p(b)=0.25, p(c)=0.25, the entropy H = ++1.75++ bit/character.
=> Perfect! You understand how to calculate entropy for signals with different probabilities.
=< Remember the formula H = Σ p_i × ld(1/p_i).

--choice(difficulty="medium")
Which **property** of information theory is utilized in *data compression*?
- [ ] Signal set size
- [ ] Designation space
- [x] Varying character probabilities
- [ ] Base number system
=> Excellent! Data compression takes advantage of varying probabilities to reduce average message length.
=< Think about why some characters need fewer bits than others in compressed data.

--sort(difficulty="medium")
Order these **steps** in calculating the *designation space* R for a signal set:
- Determine the base B of the number system
- Calculate the number of positions n needed
- Multiply n by B to get R
- Verify if compression is possible based on probabilities
=> Perfect! This sequence shows the logical process for calculating designation space.
=< Consider why each step is necessary and how they build on each other.

--select(difficulty="hard")
For a **license plate** system with 26 letters and 10 digits, what determines the total signal set V?
- [ ] The sum of all possible characters
- [x] The product of possibilities at each position
- [ ] The average of letters and numbers
- [ ] The maximum of letters or numbers
=> Correct! The total number of possibilities is the product of the possibilities at each position.
=< Think about how combinations are calculated in probability theory.
::